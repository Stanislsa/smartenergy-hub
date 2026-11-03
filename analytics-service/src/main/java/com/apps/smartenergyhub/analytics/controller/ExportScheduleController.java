package com.apps.smartenergyhub.analytics.controller;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/export/schedules")
public class ExportScheduleController {
 private final MongoTemplate mongo;
 public ExportScheduleController(MongoTemplate mongo){this.mongo=mongo;}
 @GetMapping public List<Document> list(){return mongo.find(new Query().with(Sort.by(Sort.Direction.ASC,"nextRunAt")),Document.class,"export_schedules");}
 @PostMapping @ResponseStatus(HttpStatus.CREATED)
 public Document create(@RequestBody Map<String,Object> body){
  String kind=value(body,"kind","measurements").toLowerCase(Locale.ROOT), freq=value(body,"frequency","DAILY").toUpperCase(Locale.ROOT), fmt=value(body,"format","csv").toLowerCase(Locale.ROOT), dest=value(body,"destination","LOCAL").toUpperCase(Locale.ROOT);
  if(!List.of("measurements","anomalies").contains(kind))throw bad("Type d’export invalide");
  if(!List.of("csv","json","xlsx","pdf","parquet").contains(fmt))throw bad("Format d’export invalide");
  if(!List.of("DAILY","WEEKLY").contains(freq))throw bad("Fréquence invalide");
  if(!List.of("LOCAL","EMAIL","S3","EMAIL_AND_S3").contains(dest))throw bad("Destination invalide");
  String email=value(body,"email","");
  if(dest.contains("EMAIL")&&!email.contains("@"))throw bad("Une adresse email valide est requise");
  @SuppressWarnings("unchecked") List<String> cols=body.get("columns") instanceof List<?> list?(List<String>)list:List.of();
  Document doc=new Document("kind",kind).append("sensorId",value(body,"sensorId","")).append("frequency",freq).append("format",fmt)
   .append("columns",cols).append("aggregate",value(body,"aggregate","none")).append("method",value(body,"method",""))
   .append("gzip",Boolean.TRUE.equals(body.get("gzip"))).append("destination",dest).append("email",email).append("enabled",true)
   .append("createdAt",Date.from(Instant.now())).append("nextRunAt",Date.from(Instant.now().plusSeconds("DAILY".equals(freq)?86400:604800)));
  mongo.insert(doc,"export_schedules");return doc;
 }
 @PatchMapping("/{id}")
 public Document setEnabled(@PathVariable String id,@RequestBody Map<String,Object> body){
  Object enabled=body.get("enabled");if(!(enabled instanceof Boolean))throw bad("enabled doit être booléen");
  Document doc=mongo.findAndModify(Query.query(Criteria.where("_id").is(oid(id))),new Update().set("enabled",enabled).set("updatedAt",Date.from(Instant.now())),
   org.springframework.data.mongodb.core.FindAndModifyOptions.options().returnNew(true),Document.class,"export_schedules");
  if(doc==null)throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Planification introuvable");return doc;
 }
 @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
 public void delete(@PathVariable String id){var result=mongo.remove(Query.query(Criteria.where("_id").is(oid(id))),"export_schedules");if(result.getDeletedCount()==0)throw new ResponseStatusException(HttpStatus.NOT_FOUND);}
 private static ObjectId oid(String id){try{return new ObjectId(id);}catch(IllegalArgumentException e){throw bad("Identifiant invalide");}}
 private static String value(Map<String,Object> map,String key,String fallback){Object v=map.get(key);return v==null?fallback:String.valueOf(v).trim();}
 private static ResponseStatusException bad(String message){return new ResponseStatusException(HttpStatus.BAD_REQUEST,message);}
}
