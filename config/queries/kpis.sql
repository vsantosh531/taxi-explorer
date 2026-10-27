-- @param start_date DATE
-- @param end_date DATE
-- @param zip STRING
SELECT COUNT(*) AS total_trips, AVG(fare_amount) AS avg_fare
FROM samples.nyctaxi.trips
WHERE DATE(tpep_pickup_datetime) >= CAST(:start_date AS DATE)
  AND DATE(tpep_pickup_datetime) <= CAST(:end_date AS DATE)
  AND (:zip = '' OR array_contains(split(:zip, ','), CAST(pickup_zip AS STRING)))
