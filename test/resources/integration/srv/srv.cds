namespace test.int;

using {test.int} from '../db/db';

@requires : 'authenticated-user'
service BankService {
  entity Details       as projection on int.Detail;
  entity Peoples       as projection on int.People;
  entity Cards         as projection on int.Card;
  entity Products      as projection on int.Product;
  entity DummyAnimals  as projection on int.DummyAnimal;
  entity ExchangeRates as projection on int.ExchangeRate;
  action AddOneCreditToCard(ID : UUID) returns Cards;
}
