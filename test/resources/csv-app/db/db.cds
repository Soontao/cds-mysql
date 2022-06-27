namespace test.resources.csv.app.db;

using {cuid} from '@sap/cds/common';

using {
  incrementalKey,
  preDelivery,
} from '../../../../index';

type Address {
  Country  : String(255);
  Province : String(255);
  City     : String(255);
  Street   : String(255);
}

entity House : cuid {
  price   : Decimal;
  address : Address;
}

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
