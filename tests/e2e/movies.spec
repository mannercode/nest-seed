#!/bin/bash

MOVIE_ID=$(create_movie)

TEST "Get Movie" \
    200 GET /movies/${MOVIE_ID}

TEST "Update Movie" \
    200 PATCH /movies/${MOVIE_ID} \
    -H 'Content-Type: application/json' \
    -d '{ "title": "Updated Movie Title" }'

TEST "Search Movies" \
    200 GET /movies

TEST "Search Recommended Movies" \
    200 GET /movies/recommended \
    -H "Authorization: Bearer ${ACCESS_TOKEN}"

TEST "Delete Movie" \
    204 DELETE /movies/${MOVIE_ID}
