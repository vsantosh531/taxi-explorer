-- @param start_date DATE
-- @param end_date DATE
-- @param zip STRING
SELECT
  CASE
    WHEN fare_amount < 10 THEN 'Under $10'
    WHEN fare_amount < 20 THEN '$10 to $20'
    WHEN fare_amount < 40 THEN '$20 to $40'
    ELSE '$40 and over'
  END AS fare_range,
  COUNT(*) AS trips
FROM samples.nyctaxi.trips
WHERE DATE(tpep_pickup_datetime) >= CAST(:start_date AS DATE)
  AND DATE(tpep_pickup_datetime) <= CAST(:end_date AS DATE)
  AND (:zip = '' OR array_contains(split(:zip, ','), CAST(pickup_zip AS STRING)))
GROUP BY 1
ORDER BY MIN(fare_amount)
