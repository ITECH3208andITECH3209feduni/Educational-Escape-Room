# Native MongoDB migration

This package retains the earlier conversion from Mongoose/sift to the official
MongoDB driver, pinned to 7.5.0. The small application-specific persistence layer
is in db/model.js. Existing users, rooms and attempts keep their BSON IDs,
password hashes and references; no collection deletion or bulk migration runs.

The current startup, frontend, authentication and test instructions are in
../README-SECURITY.md. That guide supersedes the earlier migration instructions.
