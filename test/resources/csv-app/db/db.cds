namespace test.resources.csv.app.db;

using {
  incrementalKey,
  preDelivery,
} from '../../../../index';

entity Person : incrementalKey, preDelivery {
  Name : String(255);
}

entity ComplexTypeEntity : incrementalKey, preDelivery {
  Name       : String(125);
  Age        : Integer;
  IDCard     : Integer64;
  Weight     : Decimal;
  Height     : Double;
  Active     : Boolean;
  BirthDay   : Date;
  Sign       : DateTime;
  SignTime   : Time;
  SignTmp    : Timestamp;
  GlobalUUID : UUID;
  BlobDoc    : Binary;
}
