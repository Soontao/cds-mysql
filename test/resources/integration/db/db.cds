namespace test.int;

using {incrementID} from '../../../../index';


using {
  cuid,
  managed,
  temporal,
  Currency
} from '@sap/cds/common';

entity People : cuid, managed {
  Name            : String(30);
  Name2           : String(30);
  Age             : Integer default 18;
  virtual RealAge : Integer;
  RegisterDate    : Date;
  Cards           : Association to many Card
                      on Cards.People = $self;
  Detail          : Composition of Detail;
}

entity Detail : cuid, managed {
  BirthDay            : Date;
  Address             : String(255);
  AttachmentMediaType : String(100);
  Attachment          : LargeBinary @Core.MediaType: AttachmentMediaType;
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

type TranslatedText : localized String(255);


@cds.typeorm.config: {indices: [{
  name   : 'ProductName',
  columns: ['Name']
}]}
entity Product : cuid {
  Name  : TranslatedText;
  Price : Decimal(10, 2);
}


entity DummyAnimal : incrementID {
  Name : String(255);
}

entity ExchangeRate : temporal, managed {
  key Source : Currency;
  key Target : Currency;
      Rate   : Decimal(10, 2);
}
