package com.apps.smartenergyhub.analytics.service;
import java.io.IOException;
import java.io.OutputStream;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Générateur PDF page par page : seule la page en cours reste en mémoire. */
public final class PdfExportWriter {
 private final OutputStream out;
 private final List<String> columns;
 private final List<String> lines=new ArrayList<>();
 private final List<Long> offsets=new ArrayList<>();
 private long position;
 private int pages;
 public PdfExportWriter(OutputStream out,List<String> columns,Map<String,Object> metadata)throws IOException{
  this.out=out;this.columns=columns;write("%PDF-1.4\n% SmartEnergy Hub\n");
  add("SmartEnergy Hub - Export");
  add("Generated at "+metadata.get("generatedAt")+" | Export "+metadata.get("exportId"));
  add(String.join(" | ",columns));
 }
 public void write(Map<String,Object> row)throws IOException{
  List<String> cells=new ArrayList<>();
  for(String column:columns)cells.add(column+": "+String.valueOf(row.get(column)));
  add(String.join(" | ",cells));
 }
 private void add(String text)throws IOException{lines.add(ascii(text));if(lines.size()>=48)flushPage();}
 private void flushPage()throws IOException{
  if(lines.isEmpty())return;
  StringBuilder body=new StringBuilder();
  for(int i=0;i<lines.size();i++)body.append("BT /F1 8 Tf 1 0 0 1 32 ").append(810-i*16).append(" Tm (").append(escape(lines.get(i))).append(") Tj ET\n");
  byte[] data=body.toString().getBytes(java.nio.charset.StandardCharsets.US_ASCII);
  int pageId=4+pages*2,streamId=pageId+1;
  object(pageId,"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents "+streamId+" 0 R >>");
  reserve(streamId);write(streamId+" 0 obj\n<< /Length "+data.length+" >>\nstream\n");out.write(data);position+=data.length;write("\nendstream\nendobj\n");
  pages++;lines.clear();
 }
 private void object(int id,String body)throws IOException{reserve(id);write(id+" 0 obj\n"+body+"\nendobj\n");}
 private void reserve(int id){while(offsets.size()<=id)offsets.add(-1L);offsets.set(id,position);}
 private void write(String value)throws IOException{byte[] bytes=value.getBytes(java.nio.charset.StandardCharsets.US_ASCII);out.write(bytes);position+=bytes.length;}
 private static String ascii(String s){return Normalizer.normalize(s,Normalizer.Form.NFD).replaceAll("\\p{M}+","").replaceAll("[^\\x20-\\x7E]","?");}
 private static String escape(String s){return s.replace("\\","\\\\").replace("(","\\(").replace(")","\\)").replace("\r"," ").replace("\n"," ");}
 public void close()throws IOException{
  flushPage();if(pages==0){add("No data");flushPage();}
  StringBuilder kids=new StringBuilder();for(int i=0;i<pages;i++)kids.append(4+i*2).append(" 0 R ");
  object(2,"<< /Type /Pages /Kids ["+kids+"] /Count "+pages+" >>");
  object(1,"<< /Type /Catalog /Pages 2 0 R >>");
  object(3,"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  long xref=position;write("xref\n0 "+offsets.size()+"\n0000000000 65535 f \n");
  for(int i=1;i<offsets.size();i++)write(String.format(java.util.Locale.ROOT,"%010d 00000 n \n",offsets.get(i)));
  write("trailer\n<< /Size "+offsets.size()+" /Root 1 0 R >>\nstartxref\n"+xref+"\n%%EOF\n");out.flush();
 }
}
