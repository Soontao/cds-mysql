namespace test.resources.csv.app.srv;

using {test.resources.csv.app.db} from '../db/db';

service AppService {

  entity Houses     as projection on db.House excluding {
    PreDelivery,
    Disabled
  };

  entity Peoples    as projection on db.Person excluding {
    PreDelivery,
    Disabled
  };

  entity TypeEntity as projection on db.ComplexTypeEntity excluding {
    PreDelivery,
    Disabled
  };

  entity Areas      as projection on db.Area;
  entity Cities     as projection on db.City;
}
