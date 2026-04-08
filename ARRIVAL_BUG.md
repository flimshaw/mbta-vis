I'm seeing the following behavior, this is not always exactly the same bug, but there is a lot of confusion in the vehicle info pane on the right around arrivals and departures. review the code and ensure that we are calculating the arrival/departure stations in a sensible way. I have listed a series of updates i've gotten for a single train, and have tagged where the status appears to be wrong. This *should* be a clean STATION A -> B -> C -> D, but it loses its place. I suspect this may have to do with a convoluted method of computing next and previous stations? perhaps we can refactor to have this hold very close to the exact data coming from the API?

Here is the observed behavior currently:

1. RIGHT - train is moving from STATION A listed in the left to "next STATION B"
2. RIGHT - train is arriving at STATION B (listed left), next station updates properly
3. RIGHT - train is stopped at STATION B, next station updates to STATION C
4. WRONG - (things start breaking) train lists as STATION A again, moving to STATION B
5. WRONG - train lists arriving at STATION B again
6. RIGHT - train lists arriving at STATION C, next is STATION D
7. RIGHT - train stopped at STATION C
8. WRONG - train moving at STATION B, -> STATION C
9. RIGHT - train arriving at STATION D
