namespace test.resources.integration;


using {
  cuid,
  managed
} from '@sap/cds/common';

entity People : cuid, managed {
  Name         : String(30);
  Age          : Integer default 18;
  RegisterDate : Date;
  Cards        : Association to many Card
                   on Cards.People = $self;
  Detail       : Composition of Detail;
}

entity Detail : cuid, managed {
  BirthDay : Date;
  Address  : String(255);
}

entity Card : cuid, managed {
  Number         : String(50);
  CertDate       : Date;
  ActiveDate     : Date default $now;
  People         : Association to one People;
  Active         : Boolean default false;
  Credit         : Decimal(30, 2) default 100.001;
  Debit          : Decimal(30, 2) default 100.001;
  ExampleInt64   : Integer64 default 1000000000;
  ExampleInt64_2 : Integer64 default null;
  ExampleBoolean : Boolean default null;
  ExampleTS1     : Timestamp default $now;
  ExampleTS2     : Timestamp default null;
  ExampleDT1     : DateTime default null;
  ExampleDT2     : DateTime default $now;
}
