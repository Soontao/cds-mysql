namespace test.property.type;

type Name : String(20);

entity People {
  key Name                : Name default 'Unknown';
      Age                 : Integer default 10;
      Credit              : Decimal(10, 2) default 1.0;
      FullEmployee        : Boolean default false;
      Active              : Boolean default true;
      BirthDay            : Date not null;
      BirthDateTime       : DateTime;
  key Type                : String(10) enum {
        normal = 'normal';
        high   = 'high';
      };
      Avatar              : Binary(255);
      Picture             : LargeString;
      rank                : array of String(25);
      UInt8Property       : UInt8;
      Int16Property       : Int16;
      Int32Property       : Int32;
      Int64Property       : Int64;
      Integer64Property   : Integer64;
      ![Create]           : Boolean default false;
      ![Key]              : Integer not null;
      DoubleProperty      : Double;
      StringWithoutLength : String;
}
