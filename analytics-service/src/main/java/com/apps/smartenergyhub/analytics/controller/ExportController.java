package com.apps.smartenergyhub.analytics.controller;

import com.apps.smartenergyhub.analytics.calculator.AnomalyType;
import com.apps.smartenergyhub.analytics.dto.MeasurementResponse;
import com.apps.smartenergyhub.analytics.dto.SensorResponse;
import com.apps.smartenergyhub.analytics.exception.BadRequestException;
import com.apps.smartenergyhub.analytics.service.AnalyticsService;
import com.apps.smartenergyhub.analytics.service.MeasurementQueryService;
import com.apps.smartenergyhub.analytics.service.SensorService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.bson.Document;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.security.DigestOutputStream;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.zip.GZIPOutputStream;

@RestController
@RequestMapping("/api/export")
@RequiredArgsConstructor
public class ExportController {
    private static final List<String> MEASUREMENT_COLUMNS = List.of("sensorId", "timestamp", "powerKw", "voltage", "current", "frequency", "temperature", "measurementCount");
    private static final List<String> ANOMALY_COLUMNS = List.of("sensorId", "timestamp", "method", "powerKw", "score", "limit", "value");
    private final MeasurementQueryService measurements;
    private final AnalyticsService analytics;
    private final SensorService sensors;
    private final MongoTemplate mongo;
    private final ObjectMapper mapper;
    @Value("#{environment.getProperty('export.signing-secret','')}")
    private String signingSecret;

    @GetMapping("/measurements")
    public ResponseEntity<StreamingResponseBody> measurements(
            @RequestParam(required = false) String sensorId,
            @RequestParam Instant from, @RequestParam Instant to,
            @RequestParam(defaultValue = "csv") String format,
            @RequestParam(required = false) String columns,
            @RequestParam(defaultValue = "none") String aggregate,
            @RequestParam(defaultValue = "false") boolean gzip) {
        String fmt = format(format);
        List<String> cols = columns(columns, MEASUREMENT_COLUMNS);
        String grouping = aggregate.toLowerCase(Locale.ROOT);
        if (!List.of("none", "hour", "day", "week").contains(grouping)) throw new BadRequestException("aggregate doit être none, hour, day ou week");
        validate(from, to, 365);
        Map<String,Object> filters = Map.of("sensorId", blank(sensorId) ? "all" : sensorId, "from", from.toString(), "to", to.toString(), "columns", cols, "aggregate", grouping, "format", fmt, "gzip", gzip);
        return download("measurements", fmt, gzip, cols, filters, (writer, count) -> {
            List<SensorResponse> targets = blank(sensorId) ? sensors.findAll(null, null) : List.of(sensors.get(sensorId));
            if ("none".equals(grouping)) {
                for (SensorResponse sensor : targets) {
                    measurements.streamHistory(sensor.sensorId(), from, to, point -> {
                        try { writer.write(measurementRow(point)); count[0]++; }
                        catch (IOException e) { throw new WriteFailure(e); }
                    });
                }
            } else {
                Map<String, Bucket> buckets = new TreeMap<>();
                for (SensorResponse sensor : targets) {
                    measurements.streamHistory(sensor.sensorId(), from, to, point -> {
                        String time = bucket(point.timestamp(), grouping);
                        String key = sensor.sensorId() + "|" + time;
                        buckets.computeIfAbsent(key, ignored -> new Bucket(sensor.sensorId(), time)).add(point);
                    });
                }
                for (Bucket bucket : buckets.values()) { writer.write(bucket.row()); count[0]++; }
            }
        });
    }

    @GetMapping("/anomalies")
    public ResponseEntity<StreamingResponseBody> anomalies(
            @RequestParam(required = false) String sensorId,
            @RequestParam Instant from, @RequestParam Instant to,
            @RequestParam(defaultValue = "csv") String format,
            @RequestParam(required = false) String columns,
            @RequestParam(required = false) String method,
            @RequestParam(defaultValue = "false") boolean gzip) {
        String fmt = format(format);
        List<String> cols = columns(columns, ANOMALY_COLUMNS);
        validate(from, to, 31);
        AnomalyType methodFilter = null;
        if (!blank(method)) {
            try { methodFilter = AnomalyType.valueOf(method.toUpperCase(Locale.ROOT)); }
            catch (IllegalArgumentException e) { throw new BadRequestException("Type d’anomalie inconnu : " + method); }
        }
        AnomalyType selectedMethod = methodFilter;
        Map<String,Object> filters = Map.of("sensorId", blank(sensorId) ? "all" : sensorId, "from", from.toString(), "to", to.toString(), "method", blank(method) ? "all" : method, "columns", cols, "format", fmt, "gzip", gzip);
        return download("anomalies", fmt, gzip, cols, filters, (writer, count) -> {
            List<SensorResponse> targets = blank(sensorId) ? sensors.findAll(null, null) : List.of(sensors.get(sensorId));
            for (SensorResponse sensor : targets) {
                var report = analytics.allAnomalies(sensor.sensorId(), from, to, 3, 50, 210, 250, 80);
                for (var anomaly : report.anomalies()) {
                    if (selectedMethod != null && anomaly.method() != selectedMethod) continue;
                    Map<String,Object> row = new LinkedHashMap<>();
                    row.put("sensorId", sensor.sensorId()); row.put("timestamp", anomaly.timestamp()); row.put("method", anomaly.method());
                    row.put("powerKw", anomaly.powerKw()); row.put("score", anomaly.score()); row.put("limit", anomaly.limit()); row.put("value", anomaly.value());
                    writer.write(row); count[0]++;
                }
            }
        });
    }

    @GetMapping("/preview/measurements")
    public Map<String,Object> preview(@RequestParam String sensorId, @RequestParam Instant from, @RequestParam Instant to) {
        validate(from, to, 31);
        List<MeasurementResponse> rows = measurements.history(sensorId, from, to, 20);
        return Map.of("sensorId", sensorId, "from", from, "to", to, "rows", rows);
    }

    @GetMapping("/history")
    public List<Map> history() {
        Query query = new Query().with(Sort.by(Sort.Direction.DESC, "createdAt")).limit(20);
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getName()))
            query.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("user").is(auth.getName()));
        return mongo.find(query, Map.class, "export_history");
    }

    private ResponseEntity<StreamingResponseBody> download(String kind, String format, boolean gzip, List<String> columns, Map<String,Object> filters, ExportTask task) {
        String id = java.util.UUID.randomUUID().toString();
        String filename = kind + "-" + Instant.now().toString().replace(":", "-") + "." + format + (gzip ? ".gz" : "");
        String generatedAt = Instant.now().toString();
        String exportedBy = user();
        Map<String,Object> metadata = Map.of("exportId", id, "generatedAt", generatedAt, "user", exportedBy, "filters", filters);
        StreamingResponseBody body = output -> {
            MessageDigest digest;
            try { digest = MessageDigest.getInstance("SHA-256"); } catch (java.security.NoSuchAlgorithmException e) { throw new IOException(e); }
            long[] count = {0};
            boolean success = false;
            try {
                OutputStream hashed = new DigestOutputStream(output, digest);
                OutputStream encoded = gzip ? new GZIPOutputStream(hashed, 32768) : hashed;
                try (Writer writer = new Writer(encoded, format, columns, metadata, mapper)) { task.write(writer, count); }
                success = true;
            } catch (WriteFailure e) {
                throw e.io;
            } finally {
                Map<String,Object> record = new LinkedHashMap<>();
                record.put("exportId", id); record.put("type", kind); record.put("format", format); record.put("filename", filename);
                record.put("generatedAt", generatedAt); record.put("completedAt", Instant.now().toString()); record.put("user", exportedBy);
                record.put("filters", filters); record.put("rows", count[0]); record.put("status", success ? "completed" : "failed");
                byte[] hash = digest.digest();
                record.put("sha256", HexFormat.of().formatHex(hash));
                if (!signingSecret.isBlank()) {
                    try {
                        javax.crypto.Mac mac = javax.crypto.Mac.getInstance("HmacSHA256");
                        mac.init(new javax.crypto.spec.SecretKeySpec(signingSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
                        record.put("signatureAlgorithm", "HmacSHA256");
                        record.put("signature", HexFormat.of().formatHex(mac.doFinal(hash)));
                    } catch (java.security.GeneralSecurityException ignored) { }
                }
                try { mongo.save(new Document(record), "export_history"); } catch (RuntimeException ignored) { }
            }
        };
        String content = gzip ? "application/gzip" : switch(format) {
            case "json" -> "application/json";
            case "xlsx" -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            case "pdf" -> "application/pdf";
            case "parquet" -> "application/vnd.apache.parquet";
            default -> "text/csv";
        };
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(content))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .header(HttpHeaders.CACHE_CONTROL, "no-store").header("X-Export-Id", id)
                .header("X-Accel-Buffering", "no").body(body);
    }

    private static Map<String,Object> measurementRow(MeasurementResponse p) {
        Map<String,Object> row = new LinkedHashMap<>();
        row.put("sensorId", p.sensorId()); row.put("timestamp", p.timestamp()); row.put("powerKw", p.powerKw());
        row.put("voltage", p.voltage()); row.put("current", p.current()); row.put("frequency", p.frequency()); row.put("temperature", p.temperature()); row.put("measurementCount", 1);
        return row;
    }
    private static List<String> columns(String requested, List<String> allowed) {
        if (blank(requested)) return allowed;
        List<String> chosen = new ArrayList<>();
        for (String c : requested.split(",")) {
            String col = c.trim();
            if (!allowed.contains(col)) throw new BadRequestException("Colonne inconnue : " + col);
            if (!chosen.contains(col)) chosen.add(col);
        }
        if (chosen.isEmpty()) throw new BadRequestException("Sélectionnez une colonne");
        return chosen;
    }
    private static String format(String value) {
        String fmt = value.toLowerCase(Locale.ROOT);
        if (!List.of("csv", "json", "xlsx", "pdf", "parquet").contains(fmt)) throw new BadRequestException("format doit être csv, json, xlsx, pdf ou parquet");
        return fmt;
    }
    private static void validate(Instant from, Instant to, int days) {
        if (from == null || to == null || !from.isBefore(to)) throw new BadRequestException("'from' doit précéder 'to'");
        if (java.time.Duration.between(from, to).compareTo(java.time.Duration.ofDays(days)) > 0) throw new BadRequestException("La période maximale est de " + days + " jours");
    }
    private static boolean blank(String s) { return s == null || s.isBlank(); }
    private static String bucket(Instant t, String group) {
        var z = t.atZone(ZoneOffset.UTC);
        return switch (group) {
            case "hour" -> z.truncatedTo(java.time.temporal.ChronoUnit.HOURS).toInstant().toString();
            case "day" -> z.toLocalDate().atStartOfDay(ZoneOffset.UTC).toInstant().toString();
            default -> z.toLocalDate().with(TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY)).atStartOfDay(ZoneOffset.UTC).toInstant().toString();
        };
    }
    private String user() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null ? "anonymous" : auth.getName();
    }
    @FunctionalInterface private interface ExportTask { void write(Writer writer, long[] count) throws IOException; }
    private static final class WriteFailure extends RuntimeException { final IOException io; WriteFailure(IOException io) { this.io = io; } }

    private static final class Bucket {
        final String sensor, time; long n; double power, voltage, current, frequency, temperature;
        Bucket(String sensor, String time) { this.sensor=sensor; this.time=time; }
        void add(MeasurementResponse p) { n++; if(p.powerKw()!=null)power+=p.powerKw(); if(p.voltage()!=null)voltage+=p.voltage(); if(p.current()!=null)current+=p.current(); if(p.frequency()!=null)frequency+=p.frequency(); if(p.temperature()!=null)temperature+=p.temperature(); }
        Map<String,Object> row() { Map<String,Object> r=new LinkedHashMap<>(); r.put("sensorId",sensor); r.put("timestamp",time); r.put("powerKw",avg(power)); r.put("voltage",avg(voltage)); r.put("current",avg(current)); r.put("frequency",avg(frequency)); r.put("temperature",avg(temperature)); r.put("measurementCount",n); return r; }
        Double avg(double n) { return this.n==0?null:Math.round(n/this.n*100.0)/100.0; }
    }

    private static final class Writer implements AutoCloseable {
        final String format;
        final List<String> columns;
        final ObjectMapper mapper;
        final OutputStream stream;
        BufferedWriter out;
        org.apache.poi.xssf.streaming.SXSSFWorkbook workbook;
        org.apache.poi.xssf.streaming.SXSSFSheet sheet;
        com.apps.smartenergyhub.analytics.service.PdfExportWriter pdf;
        org.apache.parquet.hadoop.ParquetWriter<org.apache.avro.generic.GenericRecord> parquet;
        org.apache.avro.Schema parquetSchema;
        java.nio.file.Path parquetTemp;
        int rowNumber = 0;
        int sheetNumber = 1;
        String lastSensor;
        final java.util.Set<String> sheetNames = new java.util.HashSet<>();
        boolean first = true;

        Writer(OutputStream stream, String format, List<String> columns, Map<String,Object> metadata, ObjectMapper mapper) throws IOException {
            this.stream = stream; this.format = format; this.columns = columns; this.mapper = mapper;
            if ("csv".equals(format)) {
                out = new BufferedWriter(new OutputStreamWriter(stream, StandardCharsets.UTF_8));
                out.write("# SmartEnergy Hub | generatedAt=" + metadata.get("generatedAt") + " | exportId=" + metadata.get("exportId") + "\r\n");
                out.write("# filters=" + csv(metadata.get("filters")) + "\r\n");
                out.write(String.join(",", columns) + "\r\n");
            } else if ("json".equals(format)) {
                out = new BufferedWriter(new OutputStreamWriter(stream, StandardCharsets.UTF_8));
                out.write("{\"metadata\":" + mapper.writeValueAsString(metadata) + ",\"data\":[");
            } else if ("pdf".equals(format)) {
                pdf = new com.apps.smartenergyhub.analytics.service.PdfExportWriter(stream, columns, metadata);
            } else if ("parquet".equals(format)) {
                try { parquetTemp = java.nio.file.Files.createTempFile("smartenergy-export-", ".parquet"); }
                catch (IOException e) { throw e; }
                org.apache.avro.Schema nullSchema = org.apache.avro.Schema.create(org.apache.avro.Schema.Type.NULL);
                org.apache.avro.Schema recordSchema = org.apache.avro.Schema.createRecord("SmartEnergyExport", null, "com.apps.smartenergyhub.export", false);
                List<org.apache.avro.Schema.Field> fields = new ArrayList<>();
                for (String column : columns) {
                    org.apache.avro.Schema type = column.equals("sensorId") || column.equals("timestamp") || column.equals("method")
                            ? org.apache.avro.Schema.create(org.apache.avro.Schema.Type.STRING)
                            : ("measurementCount".equals(column) ? org.apache.avro.Schema.create(org.apache.avro.Schema.Type.LONG)
                            : org.apache.avro.Schema.create(org.apache.avro.Schema.Type.DOUBLE));
                    fields.add(new org.apache.avro.Schema.Field(column, org.apache.avro.Schema.createUnion(List.of(nullSchema, type)), null, (Object) null));
                }
                recordSchema.setFields(fields);
                parquetSchema = recordSchema;
                parquet = org.apache.parquet.avro.AvroParquetWriter.<org.apache.avro.generic.GenericRecord>builder(new org.apache.hadoop.fs.Path(parquetTemp.toUri()))
                        .withSchema(parquetSchema).withConf(new org.apache.hadoop.conf.Configuration())
                        .withCompressionCodec(org.apache.parquet.hadoop.metadata.CompressionCodecName.SNAPPY)
                        .withExtraMetaData(Map.of("exportId", String.valueOf(metadata.get("exportId")), "generatedAt", String.valueOf(metadata.get("generatedAt"))))
                        .build();
            } else {
                workbook = new org.apache.poi.xssf.streaming.SXSSFWorkbook(100);
                workbook.setCompressTempFiles(true);
                sheet = workbook.createSheet("Export");
                sheetNames.add("Export");
                sheet.createFreezePane(0, 1);
                org.apache.poi.ss.usermodel.Row header = sheet.createRow(rowNumber++);
                for (int i=0;i<columns.size();i++) header.createCell(i).setCellValue(columns.get(i));
                var metaSheet = workbook.createSheet("Métadonnées");
                sheetNames.add("Métadonnées");
                int i=0;
                for (var entry : metadata.entrySet()) {
                    var row=metaSheet.createRow(i++);
                    row.createCell(0).setCellValue(entry.getKey());
                    row.createCell(1).setCellValue(entry.getValue() instanceof Map ? mapper.writeValueAsString(entry.getValue()) : String.valueOf(entry.getValue()));
                }
            }
        }
        void write(Map<String,Object> row) throws IOException {
            if ("csv".equals(format)) {
                for(int i=0;i<columns.size();i++){ if(i>0)out.write(','); out.write(csv(row.get(columns.get(i)))); }
                out.write("\r\n");
            } else if ("json".equals(format)) {
                if(!first)out.write(','); first=false;
                Map<String,Object> selected=new LinkedHashMap<>(); for(String c:columns)selected.put(c,row.get(c));
                out.write(mapper.writeValueAsString(selected));
            } else if ("pdf".equals(format)) {
                pdf.write(row);
            } else if ("parquet".equals(format)) {
                org.apache.avro.generic.GenericRecord record = new org.apache.avro.generic.GenericData.Record(parquetSchema);
                for (String column : columns) {
                    Object value = row.get(column);
                    if (value instanceof java.time.Instant instant) value = instant.toString();
                    if (value instanceof Number number) {
                        value = "measurementCount".equals(column) ? number.longValue() : number.doubleValue();
                    }
                    record.put(column, value);
                }
                parquet.write(record);
            } else {
                String sensor = String.valueOf(row.getOrDefault("sensorId", "Export"));
                if (lastSensor == null) {
                    lastSensor = sensor;
                    workbook.setSheetName(0, sheetName(sensor));
                } else if (!lastSensor.equals(sensor)) {
                    lastSensor = sensor;
                    sheet = workbook.createSheet(sheetName(sensor));
                    rowNumber = 0;
                    org.apache.poi.ss.usermodel.Row header = sheet.createRow(rowNumber++);
                    for (int i=0;i<columns.size();i++) header.createCell(i).setCellValue(columns.get(i));
                }
                if (rowNumber >= 1_048_576) {
                    sheet = workbook.createSheet("Export-" + (++sheetNumber));
                    sheet.createFreezePane(0, 1);
                    rowNumber = 0;
                    org.apache.poi.ss.usermodel.Row header = sheet.createRow(rowNumber++);
                    for (int i=0;i<columns.size();i++) header.createCell(i).setCellValue(columns.get(i));
                }
                var excelRow = sheet.createRow(rowNumber++);
                for (int i=0;i<columns.size();i++) {
                    Object value=row.get(columns.get(i));
                    if(value==null) continue;
                    var cell=excelRow.createCell(i);
                    if(value instanceof Number n) cell.setCellValue(n.doubleValue());
                    else cell.setCellValue(String.valueOf(value));
                }
            }
        }
        public void close() throws IOException {
            if("json".equals(format))out.write("]}");
            if(out!=null){out.flush();out.close();return;}
            if(pdf!=null){pdf.close();stream.close();return;}
            if(parquet!=null){
                try{parquet.close();java.nio.file.Files.copy(parquetTemp,stream);stream.flush();}
                finally{java.nio.file.Files.deleteIfExists(parquetTemp);stream.close();}
                return;
            }
            if(workbook!=null){try{workbook.write(stream);}finally{try{workbook.close();}finally{workbook.dispose();}}}
            stream.flush();
            stream.close();
        }
        private String sheetName(String sensor) {
            String safe = ("Capteur-" + sensor).replaceAll("[\\[\\]:*?/\\\\]", "-");
            if (safe.length() > 31) safe = safe.substring(0, 31);
            String base = safe;
            int suffix = 2;
            while (sheetNames.contains(safe)) {
                String tail = "-" + suffix++;
                safe = base.substring(0, Math.min(base.length(), 31 - tail.length())) + tail;
            }
            sheetNames.add(safe);
            return safe;
        }
        private static String csv(Object value) {
            if(value==null)return "";
            String s=value instanceof Map||value instanceof List ? value.toString() : String.valueOf(value);
            return "\"" + s.replace("\"","\"\"") + "\"";
        }
    }

}
