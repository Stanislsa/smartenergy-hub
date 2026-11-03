package com.apps.smartenergyhub.analytics.service;
import com.apps.smartenergyhub.analytics.controller.ExportController;
import jakarta.mail.internet.MimeMessage;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Date;
import java.util.List;

@Service
public class ScheduledExportRunner {
 private final MongoTemplate mongo; private final ExportController exports;
 private final ObjectProvider<JavaMailSender> mailProvider; private final ObjectProvider<S3Client> s3Provider;
 private final Path storage; private final String bucket,fromAddress;
 public ScheduledExportRunner(MongoTemplate mongo,ExportController exports,ObjectProvider<JavaMailSender> mailProvider,ObjectProvider<S3Client> s3Provider,
  @Value("#{environment.getProperty('export.storage-dir','/exports')}") String storage,
  @Value("#{environment.getProperty('export.s3.bucket','')}") String bucket,
  @Value("#{environment.getProperty('export.email.from','')}") String fromAddress){
  this.mongo=mongo;this.exports=exports;this.mailProvider=mailProvider;this.s3Provider=s3Provider;this.storage=Path.of(storage);this.bucket=bucket;this.fromAddress=fromAddress;
 }
 @Scheduled(fixedDelayString="#{environment.getProperty('export.schedule.poll-ms','30000')}")
 public void runDueSchedules(){
  Instant now=Instant.now();
  List<Document> due=mongo.find(Query.query(Criteria.where("enabled").is(true).and("nextRunAt").lte(Date.from(now))).limit(10),Document.class,"export_schedules");
  for(Document schedule:due){
   ObjectId id=schedule.getObjectId("_id");String freq=schedule.getString("frequency");Instant next=now.plusSeconds("WEEKLY".equals(freq)?604800:86400);
   Document claimed=mongo.findAndModify(Query.query(Criteria.where("_id").is(id).and("enabled").is(true).and("nextRunAt").lte(Date.from(now))),
    new Update().set("nextRunAt",Date.from(next)).set("lastStatus","running").set("lastRunAt",Date.from(now)),
    org.springframework.data.mongodb.core.FindAndModifyOptions.options().returnNew(true),Document.class,"export_schedules");
   if(claimed!=null)process(claimed,id,now,next);
  }
 }
 private void process(Document s,ObjectId id,Instant runAt,Instant next){
  try{
   Files.createDirectories(storage);boolean weekly="WEEKLY".equals(s.getString("frequency"));Instant to=runAt,from=to.minusSeconds(weekly?604800:86400);
   String kind=s.getString("kind"),fmt=s.getString("format"),sensor=s.getString("sensorId");
   @SuppressWarnings("unchecked") List<String> cols=(List<String>)s.get("columns",List.class);if(cols==null)cols=List.of();
   boolean gzip=Boolean.TRUE.equals(s.getBoolean("gzip"));String filename="scheduled-"+id+"-"+runAt.toString().replace(":","-")+"."+fmt+(gzip?".gz":"");Path file=storage.resolve(filename);
   StreamingResponseBody body="anomalies".equals(kind)
    ?exports.anomalies(sensor,from,to,fmt,String.join(",",cols),s.getString("method"),gzip).getBody()
    :exports.measurements(sensor,from,to,fmt,String.join(",",cols),s.getString("aggregate"),gzip).getBody();
   try(OutputStream out=Files.newOutputStream(file)){body.writeTo(out);}
   String dest=s.getString("destination");if(dest.contains("S3"))upload(file,filename);if(dest.contains("EMAIL"))email(s.getString("email"),file,filename);
   mongo.updateFirst(Query.query(Criteria.where("_id").is(id)),new Update().set("lastStatus","completed").set("lastMessage",filename).set("lastCompletedAt",Date.from(Instant.now())).set("nextRunAt",Date.from(next)),"export_schedules");
  }catch(Exception e){String msg=e.getMessage()==null?e.getClass().getSimpleName():e.getMessage();mongo.updateFirst(Query.query(Criteria.where("_id").is(id)),new Update().set("lastStatus","failed").set("lastMessage",msg.substring(0,Math.min(400,msg.length()))).set("lastCompletedAt",Date.from(Instant.now())).set("nextRunAt",Date.from(next)),"export_schedules");}
 }
 private void upload(Path file,String key){
  S3Client s3=s3Provider.getIfAvailable();if(s3==null||bucket.isBlank())throw new IllegalStateException("S3/MinIO non configuré");
  s3.putObject(PutObjectRequest.builder().bucket(bucket).key(key).build(),RequestBody.fromFile(file));
 }
 private void email(String address,Path file,String filename)throws Exception{
  JavaMailSender sender=mailProvider.getIfAvailable();if(sender==null||fromAddress.isBlank())throw new IllegalStateException("SMTP non configuré");
  MimeMessage message=sender.createMimeMessage();MimeMessageHelper helper=new MimeMessageHelper(message,true,"UTF-8");
  helper.setFrom(fromAddress);helper.setTo(address);helper.setSubject("Votre export SmartEnergy Hub");helper.setText("Votre export planifié est prêt. Le fichier est joint.");helper.addAttachment(filename,file.toFile());sender.send(message);
 }
}
