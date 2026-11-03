package com.apps.smartenergyhub.analytics.config;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import java.net.URI;
@Configuration
public class ExportStorageConfiguration {
 @Bean @ConditionalOnProperty(name="export.s3.bucket")
 S3Client exportS3Client(@Value("#{environment.getProperty('export.s3.region','us-east-1')}") String region,
  @Value("#{environment.getProperty('export.s3.endpoint','')}") String endpoint,
  @Value("#{environment.getProperty('export.s3.access-key','')}") String access,
  @Value("#{environment.getProperty('export.s3.secret-key','')}") String secret){
  var builder=S3Client.builder().region(Region.of(region)).serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build());
  if(!endpoint.isBlank())builder.endpointOverride(URI.create(endpoint));
  if(!access.isBlank()&&!secret.isBlank())builder.credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(access,secret)));
  return builder.build();
 }
}
