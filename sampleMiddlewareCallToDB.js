// THis should be used by a bigger NodeJS/Restify Setup

var pg = require('pg');
var config = require("./config"); // Keep your config for database login in separate file

pg.defaults.poolSize = 1;

exports = module.exports = function () {


    // Given a queryConfig object (using the node-postgres object format)
    // this just executes the query and returns results to the http client.
    function _dbExecute(queryConfig, res, next) {
        console.log("_dbExecute()");
        pg.connect(config.pg_config, function(err, client, done) {
            if (err) {
                console.log('could not connect to postgres', err);
                done();
                return 'could not connect to postgres';
            }
            console.log("_dbExecute() ==> connected to PGSQL");
            client.query(
                queryConfig,
                function (err, result) {
                    if (err) {
                        console.log('error running query', err);
                        done();
                        return 'could not connect to postgres';
                    }
                    console.log("_dbExecute() ==> running query...");
                    var queryResult = result.rows;
                    console.log("_dbExecute() ==> query run");
                    done();
                    
                    res.json(200,queryResult);
                    console.log("_dbExecute() ==> response sent");
                    return next();
                }
                );
        });
        pg.end();
    }

    return {

        // Node Query Example For a Generic Query
        // Admittedly Hacked Together Quickly
        genericQuery: function (rFuncname, rInputs, res, next) {
            console.log('genericQuery(' + rFuncname + ', ' + JSON.stringify(rInputs) + ')');

            var queryParamsArr = [];
            var queryParams = [];
            console.log("build value array");
            var cnt = 1;
            Object.keys(rInputs).forEach(
                function(key,index) {
                    if (key == 'token') {
                        console.log("rInputs[" + key + "] =  " + rInputs[key]);
                        var valueString = rInputs[key];
                        console.log("valueString = " + valueString);
                        queryParamsArr.push(valueString);
                        queryParams.push('$' + cnt);
                        cnt++;
                        return;
                    }
                }
                );
            Object.keys(rInputs).forEach(
                function(key,index) {
                    if (
                        (key != 'funcname') &&
                        (key != 'token')
                        ) {
                        console.log("rInputs[" + key + "] =  " + rInputs[key]);
                    var valueString = rInputs[key];
                    console.log("valueString = " + valueString);
                    queryParamsArr.push(valueString);
                    queryParams.push('$' + cnt);
                    cnt++;
                }
            }
            );

            queryParams = queryParams.join(',');
            console.log("placeholder array = [" + JSON.stringify(queryParams) + "]");

            var queryConfig = {
                text: "SELECT * FROM ag." + rFuncname + "(" +  queryParams + ")",
                values: queryParamsArr
            };
            _dbExecute(queryConfig,res,next);
        }
    }
};