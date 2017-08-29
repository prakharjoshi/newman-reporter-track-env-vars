'use strict';

/**
 * A custom newman reporter which track the changes in the environment variables (global/local) which have changed
 * during the course of run.
 *
 */

var _ = require('lodash'),
    colors = require('colors/safe');

// sets theme for colors for console logging
colors.setTheme({
    log: 'grey',
    info: 'cyan',
    warn: 'yellow',
    debug: 'blue',
    error: 'red'
});

var customReporter = function (newman, reporterOptions, options) {
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

    newman.on('script', function (err, args) {
        // This is done so that we print the request name only once for preTest and test script for a request.
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
         * @returns {{}}
         */
        envVarsCompare = function (oldEnv, newEnv) {
            var result = {},
                extraKeys = [];
            // if keys are not equal, check if it is added/deleted
            if (!_.isEqual(Object.keys(oldEnv), Object.keys(newEnv))) {
                // List out all the extra keys.
                extraKeys = _.xor(Object.keys(oldEnv), Object.keys(newEnv));
                // Check weather the key is added or deleted
                _.forEach(extraKeys, function (key) {
                    if (_.has(oldEnv, key) && !_.has(newEnv, key)) {
                        result[key] = { oldValue: oldEnv[key], newValue: null };
                    }
                    if (_.has(newEnv, key) && !_.has(oldEnv, key)) {
                        result[key] = { oldValue: null, newValue: newEnv[key] };
                    }
                });
            }

            // also compare the existing keys in both the envs, if they have changed or not
            _.forEach(Object.keys(oldEnv).pop(extraKeys), function (key) {
                if (oldEnv[key] !== newEnv[key]) {
                    result[key] = { oldValue: oldEnv[key], newValue: newEnv[key] };
                }
            });

            return result;
        };

        // Get the diff of env for both global and local envs.
        var globalEnvDiff = envVarsCompare(global, IncomingGlobal),
          localEnvDiff = envVarsCompare(environment, IncomingEnv);

        // Print the env diff.
        if (!_.isEmpty(globalEnvDiff)) {
            printRequestName && console.info('->', args.item.name);

            console.info(' ', colors.gray.underline(args.execution.target));

            console.info('   ↳ ' + colors.cyan('GLOBALS') + '\n', '    ', globalEnvDiff, '\n');
        }

        if (!_.isEmpty(localEnvDiff)) {
            printRequestName && console.info('->', args.item.name);

            console.info(' ', colors.gray.underline(args.execution.target));

            console.info('   ↳ ' + colors.cyan('LOCAL') + '\n', '    ', localEnvDiff, '\n');
        }

        // Override the existing global with the new global object as now global/local is updated and in next request we will
        // get new incoming global and local env.
        global = IncomingGlobal;
        environment = IncomingEnv;

        // Increase the count so that when next request comes we will not again fetch the default global/local
        count++;
    });

    newman.on('done', function (err) {
        err && console.info(err);
        console.info(colors.green("Run completed"));
    });
};

customReporter.prototype.dominant = true;
module.exports = customReporter;
