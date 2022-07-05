using {test.resources.fiori.db} from '../db/db.cds';

service FioriService {
  @odata.draft.enabled
  entity Persons as projection on db.Person;
}
