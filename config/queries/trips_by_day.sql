-- @param start_date DATE
-- @param end_date DATE
-- @param zip STRING
SELECT date(tpep_pickup_datetime) AS day, count(*) AS trips
FROM samples.nyctaxi.trips
WHERE date(tpep_pickup_datetime) >= CAST(:start_date AS DATE)
  AND date(tpep_pickup_datetime) <= CAST(:end_date AS DATE)
  AND (:zip = '' OR array_contains(split(:zip, ','), CAST(pickup_zip AS STRING)))
GROUP BY 1
ORDER BY 1;
