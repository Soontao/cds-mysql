/**
 * support auto increment ID for cds mysql
 */
define aspect incrementID {
  /**
   * Auto Incremental Primary Key for entity, with mysql native
   * `AUTO_INCREMENT` support
   */
  @cds.typeorm.config : {generated : 'increment'}
  key ID : Integer64
}

/**
 * alias of incrementID
 */
define aspect incrementalKey : incrementID {}

/**
 * preDelivery aspect for CSV provisioning
 */
define aspect preDelivery {
  /**
   * is PreDelivery data, cds-mysql CSV migration will fill it as
   * `true`
   */
  PreDelivery : Boolean default false;
  /**
   * when you want to delete the data, just set this field as `true`
   * , and filter by service projection, so that the CSV migrator
   * will not `re-import` the pre-delivery data
   */
  Disabled    : Boolean default false;
}
