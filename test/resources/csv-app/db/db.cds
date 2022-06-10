namespace test.resources.csv.app.db;

using {incrementID} from '../../../../index';

entity Person : incrementID {
  Name : String(255);
}

entity ComplexTypeEntity : incrementID {
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
  Avator     : Binary;
}
