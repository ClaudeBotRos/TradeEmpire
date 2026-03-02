#!/usr/bin/env python3
"""
Fetch economic calendar from investing.com (same logic as investpy.news.economic_calendar).
Outputs JSON array of events to stdout. No investpy import (avoids pkg_resources).
Usage: python3 fetch_investing_calendar.py [from_date] [to_date]
  Dates in YYYY-MM-DD. Default: today to today+7.
"""
import json
import random
import sys
from datetime import datetime, timedelta

try:
    import requests
    from lxml.html import fromstring
except ImportError:
    print(json.dumps({"error": "pip install requests lxml"}), file=sys.stderr)
    sys.exit(1)

URL = "https://www.investing.com/economic-calendar/Service.getCalendarFilteredData"
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]
# GMT timezone id used by investing.com
TIMEZONE_IDS = [15, 56]
IMPORTANCE_RATINGS = {"1": "low", "2": "medium", "3": "high"}


def fetch_calendar(from_date: str, to_date: str):
    # from_date, to_date: YYYY-MM-DD
    payload = {
        "dateFrom": from_date,
        "dateTo": to_date,
        "timeZone": str(random.choice(TIMEZONE_IDS)),
        "timeFilter": "timeOnly",
        "currentTab": "custom",
        "submitFilters": 1,
        "limit_from": 0,
    }
    headers = {
        "User-Agent": random.choice(USER_AGENTS),
        "X-Requested-With": "XMLHttpRequest",
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Referer": "https://www.investing.com/economic-calendar/",
        "Origin": "https://www.investing.com",
        "Content-Type": "application/x-www-form-urlencoded",
    }
    events = []
    last_id = None
    limit_from = 0

    while True:
        payload["limit_from"] = limit_from
        try:
            r = requests.post(URL, headers=headers, data=payload, timeout=25)
            r.raise_for_status()
            data = r.json()
        except Exception as e:
            return {"error": str(e), "events": []}

        raw = data.get("data")
        if not raw:
            break
        root = fromstring(raw)
        rows = root.xpath(".//tr")

        # find last row id for pagination
        first_id_this_page = None
        for row in reversed(rows):
            id_attr = row.get("id")
            if id_attr and id_attr.startswith("eventRowId_"):
                first_id_this_page = id_attr.replace("eventRowId_", "")
                break
        if first_id_this_page == last_id:
            break
        last_id = first_id_this_page

        curr_date = None
        for row in rows:
            id_attr = row.get("id")
            if id_attr is None:
                # date row
                tds = row.xpath("td")
                if tds:
                    day_el = row.xpath("td")[0]
                    day_id = day_el.get("id", "")
                    if day_id.startswith("theDay"):
                        try:
                            ts = int(day_id.replace("theDay", ""))
                            dt = datetime.utcfromtimestamp(ts)
                            curr_date = dt.strftime("%Y-%m-%d")
                        except Exception:
                            pass
                continue
            if not id_attr.startswith("eventRowId_"):
                continue
            event_id = id_attr.replace("eventRowId_", "")
            time_val = zone_val = currency_val = importance_rating = event_val = actual_val = forecast_val = previous_val = None
            for value in row.xpath("td"):
                cls = value.get("class") or ""
                if "first left" in cls and "theDay" not in (value.get("id") or ""):
                    time_val = (value.text_content() or "").strip()
                elif "flagCur" in cls:
                    span = value.xpath("span")
                    if span:
                        zone_val = (span[0].get("title") or "").strip().lower()
                    currency_val = (value.text_content() or "").strip() or None
                elif "sentiment" in cls:
                    importance_rating = value.get("data-img_key")
                    if importance_rating:
                        importance_rating = IMPORTANCE_RATINGS.get(importance_rating.replace("bull", ""), importance_rating)
                elif value.get("class") == "left event":
                    event_val = (value.text_content() or "").strip()
                elif value.get("id") == "eventActual_" + event_id:
                    actual_val = (value.text_content() or "").strip() or None
                elif value.get("id") == "eventForecast_" + event_id:
                    forecast_val = (value.text_content() or "").strip() or None
                elif value.get("id") == "eventPrevious_" + event_id:
                    previous_val = (value.text_content() or "").strip() or None

            if curr_date and event_val:
                events.append({
                    "event_id": event_id,
                    "date": curr_date,
                    "time_utc": time_val,
                    "country": zone_val,
                    "currency": currency_val,
                    "importance": importance_rating or "medium",
                    "event": event_val,
                    "actual": actual_val,
                    "forecast": forecast_val,
                    "previous": previous_val,
                })
        limit_from += 1
        if limit_from > 20:
            break
    return {"events": events}


def main():
    if len(sys.argv) >= 3:
        from_date = sys.argv[1]
        to_date = sys.argv[2]
    else:
        today = datetime.utcnow()
        from_date = today.strftime("%Y-%m-%d")
        to_date = (today + timedelta(days=7)).strftime("%Y-%m-%d")
    out = fetch_calendar(from_date, to_date)
    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
