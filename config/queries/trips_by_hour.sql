-- @param start_date DATE
-- @param end_date DATE
-- @param zip STRING
SELECT hour(tpep_pickup_datetime) AS hr, count(*) AS trips
FROM samples.nyctaxi.trips
WHERE date(tpep_pickup_datetime) >= CAST(:start_date AS DATE)
  AND date(tpep_pickup_datetime) <= CAST(:end_date AS DATE)
  AND (:zip = '' OR array_contains(split(:zip, ','), CAST(pickup_zip AS STRING)))
GROUP BY hr
ORDER BY hr;
