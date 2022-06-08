CREATE DATABASE cdstest;
CREATE USER 'cdstest'@'%' IDENTIFIED BY 'cdstest'; 
GRANT ALL on cdstest.* to 'cdstest'@'%';