namespace test.resources.csv.app.db;

using {cuid} from '@sap/cds/common';

using {
  incrementID,
  preDelivery,
} from '../../../../index';

type Address {
  Country  : String(255);
  Province : String(255);
  City     : String(255);
  Street   : String(255);
}

@cds.search: {
  address_Country,
  address_Province,
  address_City,
  address_Street,
  price,
}
entity House : cuid, preDelivery {
  price   : Decimal;
  address : Address;
}

entity Area : cuid {
  Name : String(255);
  Size : Decimal(11, 3);
}

entity Person : incrementID, preDelivery {
  Name : String(255);
}

entity ComplexTypeEntity : incrementID, preDelivery {
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
  Label      : array of {
    Category : String(10);
    Value    : String(50);
  };
}

entity City : cuid {
  key Name : String(25);
      Size : Decimal(18, 3)
}
