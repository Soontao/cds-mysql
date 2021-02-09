namespace test.property.type.looooooooooooog.name.test;

using {cuid} from '@sap/cds/common';


type Name : String(20);

entity PeopleHasLongName : cuid {
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
}
