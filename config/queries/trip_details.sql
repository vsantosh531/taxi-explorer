-- @param start_date DATE
-- @param end_date DATE
-- @param zip STRING
SELECT date_format(from_utc_timestamp(tpep_pickup_datetime, 'America/New_York'), 'yyyy-MM-dd HH:mm:ss') AS pickup_time_est,
       pickup_zip, dropoff_zip, trip_distance, fare_amount
FROM samples.nyctaxi.trips
WHERE DATE(tpep_pickup_datetime) >= CAST(:start_date AS DATE)
  AND DATE(tpep_pickup_datetime) <= CAST(:end_date AS DATE)
  AND (:zip = '' OR array_contains(split(:zip, ','), CAST(pickup_zip AS STRING)))
ORDER BY tpep_pickup_datetime
LIMIT 200
