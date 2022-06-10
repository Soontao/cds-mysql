namespace test.resources.csv.app.db;

using {incrementID} from '../../../../index';

entity Person : incrementID {
  Name : String(255);
}
