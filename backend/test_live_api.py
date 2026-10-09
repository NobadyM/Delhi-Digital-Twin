import requests

url = "https://airquality.xkdr.org/v1/measurements"

headers = {
    "Authorization": "Bearer aqi_demo_wbf92Qx21zX-Wa_Tg8Dx1nXe"
}

params = {
    "city": "Delhi",
    "parameter": [
        "PM2.5",
        "PM10",
        "NO2",
        "SO2",
        "CO",
        "Ozone"
    ],
    "start": "2024-12-01",
    "end": "2024-12-02",
    "agg": "hourly",
    "limit": 100,
    "format": "json"
}

response = requests.get(
    url,
    headers=headers,
    params=params
)

print("Status code:", response.status_code)
print("Response:")
print(response.text[:10000])