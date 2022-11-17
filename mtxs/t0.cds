// mysql t0 model, a meta tenant for all tenants
namespace cds.xt;

type TenantID : String(80);

entity Jobs {
  key ID        : UUID;
  key tenant    : TenantID;
      status    : String(20) default 'queued';
      result    : LargeString;
      timestamp : Timestamp @cds.on.insert : $now;
}

entity Tenants {
  key ID       : TenantID;
      metadata : LargeString;
}
