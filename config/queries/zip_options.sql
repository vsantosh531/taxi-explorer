SELECT CAST(pickup_zip AS STRING) AS zip, COUNT(*) AS trips
FROM samples.nyctaxi.trips
GROUP BY 1
ORDER BY trips DESC
LIMIT 50
