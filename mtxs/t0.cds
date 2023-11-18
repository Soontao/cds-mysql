// patched file for t0.cds file
namespace cds.xt;

type TenantID : String(80);

entity Tenants {
  key ID         : TenantID;
      metadata   : String;
      createdAt  : Timestamp  @cds.on.insert: $now;
      modifiedAt : Timestamp  @cds.on.insert: $now  @cds.on.update: $now;

}

entity Jobs {
  key ID        : UUID; // REVISIT: cuid from cds/common?
      status    : Status default #QUEUED;
      op        : String(255);
      error     : String(255);
      result    : LargeString;
      createdAt : Timestamp;
      tasks     : Composition of many Tasks
                    on tasks.job = $self;
}

entity Tasks {
  key job       : Association to Jobs;
  key ID        : UUID; // REVISIT: cuid from cds/common?
      tenant    : TenantID;
      op        : String(255);
      error     : String(255);
      status    : Status default #QUEUED;
      createdAt : Timestamp;
      database  : String(255);
}

type Status   : String(10) enum {
  QUEUED;
  RUNNING;
  FINISHED;
  FAILED;
}
