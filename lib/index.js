/**
 * A custom newman reporter which track the changes in the environment variables (global/local) which have changed
 * during the course of run.
 *
 */

var _ = require('lodash'),
    Table = require('cli-table2'),
    colors = require('colors/safe');

customReporter = function (newman, reporterOptions, options) {
    if (options.silent || reporterOptions.silent) {
        return;
    }

    var environment = {},
        IncomingEnv = {},
        global = {},
        IncomingGlobal = {},
        count = 0;

    /**
     * Helper function to extract variables from the environment/globals object
     * @param members
     * @returns {*}
     */
    extractVars = function (members) {
        if (!members) {
            return {};
        }

        var result = _.transform(members, function (result, value) {
            result[value.key] = value.value;
        });

        return result;
    };

    // This is done so that only for first run we will take environment and global vars as those provided by users
    // After each script event, these two objects may update so we will also update them accordingly.
    if (count === 0) {
        environment = extractVars(_.get(options, 'environment.values.members'));
        global = extractVars(_.get(options, 'globals.values.members'));
    }

    var requestName,
        printRequestName = true;

    newman.on('start', function () {
        var collectionIdentifier = options.collection && (options.collection.name || options.collection.id);

        // print the newman banner
        console.info('%s\n\n', colors.reset('newman'));

        // print the collection name and newman info line
        collectionIdentifier && console.info('%s', colors.reset(collectionIdentifier) + '\n');
    });

    newman.on('script', function (err, args) {
        // // This is done so that we print the request name only once for preTest and test script for a request.
        if (requestName === args.item.name) {
            printRequestName = false;
        } else {
            requestName = args.item.name;
            printRequestName = true;
        }

        // These are the updated global and environment variables that are coming for each request
        IncomingGlobal = extractVars(args.execution.globals.values.members);
        IncomingEnv = extractVars(args.execution.environment.values.members);

        /**
         * Helper function to list out all the key value (oldValue, newValue) pair of env variables, for provided
         * oldEnv and newEnv.
         * @param oldEnv
         * @param newEnv
         * @returns {The object containing the diff of variables with their old and new values}
         */
        envVarsCompare = function (oldEnv, newEnv) {
            var result = {},
                extraKeys = [],
                oldEnvKeys = _.isObject(oldEnv) ? _.keys(oldEnv) : [],
                newEnvKeys = _.isObject(newEnv) ? _.keys(newEnv) : [];

            // if keys are not equal, check if it is added/deleted
            if (!_.isEqual(oldEnvKeys, newEnvKeys)) {
                // List out all the extra keys.
                extraKeys = _.xor(oldEnvKeys, newEnvKeys);
                // Check weather the key is added or deleted
                _.forEach(extraKeys, function (key) {
                    if (_.has(oldEnv, key) && !_.has(newEnv, key)) {
                        result[colors.red(key)] = { oldValue: oldEnv[key], newValue: colors.yellow('N/A') };
                    }
                    if (_.has(newEnv, key) && !_.has(oldEnv, key)) {
                        result[colors.green(key)] = { oldValue: colors.yellow('N/A'), newValue: newEnv[key] };
                    }
                });
            }

            // also compare the keys which are same in both the arrays.
            _.forEach(_.intersection(oldEnvKeys, newEnvKeys), function (key) {
                if (oldEnv[key] !== newEnv[key]) {
                    result[colors.yellow(key)] = { oldValue: oldEnv[key], newValue: newEnv[key] };
                }
            });

            return result;
        };

        // Get the diff of env for both global and environment vars.
        var globalVarDiff = envVarsCompare(global, IncomingGlobal),
            environmentVarDiff = envVarsCompare(environment, IncomingEnv);

        // Print request name
        printRequestName && console.info('->', args.item.name);

        // Print target Name only if there is a diff in environment/global variables.
        (!_.isEmpty(globalVarDiff) || !_.isEmpty(environmentVarDiff)) && console.info(' ', colors.gray.underline(args.execution.target));

        // Print the env diff.
        if (!_.isEmpty(globalVarDiff)) {
            var globalKeys = _.keys(globalVarDiff);

            // create the summary table
            summaryTable = new Table({
                chars: options.disableUnicode && cliUtils.cliTableTemplateFallback,
                style: { head: [] },
                head: ['Variable Name', 'Old Value', '  New Value'],
                colAligns: ['right', 'right', 'right'],
                colWidths: [25]
            });

            _.each(globalKeys, function (key) {
                summaryTable.push([key, globalVarDiff[key]['oldValue'], globalVarDiff[key]['newValue']]);
            });

            console.info('   ↳ ' + colors.cyan('GLOBAL VARIABLES'));

            console.log(summaryTable.toString());
        }

        if (!_.isEmpty(environmentVarDiff)) {
            var localKeys = _.keys(environmentVarDiff);

            // create the summary table
            summaryTable = new Table({
                chars: options.disableUnicode && cliUtils.cliTableTemplateFallback,
                style: { head: [] },
                head: ['Variable Name', 'Old Value', '  new Value'],
                colAligns: ['right', 'right', 'right'],
                colWidths: [25]
            });

            _.each(localKeys, function (key) {
                summaryTable.push([key, environmentVarDiff[key]['oldValue'], environmentVarDiff[key]['newValue']]);
            });

            console.info('   ↳ ' + colors.cyan('ENVIRONMENT VARIABLES'));

            console.log(summaryTable.toString());
        }

        // Override the existing global with the new global object as now global is updated and in next request we will
        // get new incoming global and environment vars.
        global = IncomingGlobal;
        environment = IncomingEnv;

        // Increase the count so that when next request comes we will not again fetch the default global/environment
        count++;
    });

    newman.on('done', function (err) {
        err && console.info(err);
        console.info(colors.green("Run completed"));
    });
};

customReporter.prototype.dominant = true;
module.exports = customReporter;
