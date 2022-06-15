/**
 * support auto increment ID for cds mysql
 */
define aspect incrementID {
  /**
   * Auto Incremental Primary Key for entity, with mysql native AUTO_INCREMENT support
   */
  @cds.typeorm.config : {generated : 'increment'}
  key ID : Integer64
}

/**
 * alias of incrementID
 */
define aspect incrementalKey : incrementID {}
