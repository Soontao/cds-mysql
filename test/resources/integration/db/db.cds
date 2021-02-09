namespace test.resources.integration;


using {
  cuid,
  managed
} from '@sap/cds/common';

entity People : cuid, managed {
  Name  : String(30);
  Age   : Integer default 18;
  Cards : Association to many Card
            on Cards.People = $self;
}

entity Card : cuid, managed {
  Number   : String(50);
  CertDate : Date;
  People   : Association to one People;
  Active   : Boolean default false;
  Credit   : Decimal(30, 2) default 0;
  Debit    : Decimal(30, 2) default 0;
}
