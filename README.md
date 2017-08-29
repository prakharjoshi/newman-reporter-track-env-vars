Newman Reporter Track environment Variables
===========================================

A newman reporter which tracks the changes in the environment variables (global/local) during the course of newman run.

It reports all the environment (global/local) variables for each request with each variable's previous and new value.

Command to install :-
```
npm install -g newman-reporter-track-env-vars
```

How to use this reporter with newman :-

```
newman run <Path to collection> -e <Env paths> -r newman-reporter-track-env-vars
```
