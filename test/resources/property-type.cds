namespace test.property.type;

using {cuid} from '@sap/cds/common';


type Name : String(20);

entity People : cuid {
  Name          : Name;
  Age           : Integer;
  Credit        : Decimal(10, 2);
  FullEmployee  : Boolean default false;
  BirthDay      : Date;
  BirthDateTime : DateTime;
  Type          : String enum {
    normal = 'normal';
    high   = 'high';
  };
  Avatar        : Binary(255);
}
