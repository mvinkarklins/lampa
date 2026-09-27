# Kids by age («Детям»)

Picks movies, cartoons and animated series suitable for the child's age, using TMDB data.

## Install

Settings → Extensions → Add plugin, then paste:

```
https://cdn.jsdelivr.net/gh/mvinkarklins/lampa@latest/kids_age.js
```

After a restart, a **«Детям»** item appears in the left menu. The plugin version is shown in the title of the age picker.

## How it works

1. Pick an age: under 6, 7–9, 10–12 or 13–15 (the last choice is remembered).
2. Pick a collection:
   - cartoons: popular, top rated, new, latest (by release date), box office;
   - Studio Ghibli: Hayao Miyazaki and Ghibli films suitable for the age;
   - animated series: popular, top rated, hits (most votes in recent years);
   - movies: popular, top rated, new, box office;
   - TV series: popular, hits.

For children under 6, box office and hits look back ten years; for older children, three years.

Filtering:

| Age | Movies (MPAA rating) | TV series (TV Parental Guidelines) | Extra |
|---|---|---|---|
| under 6 | G | TV-Y, TV-Y7, TV-G | only animated series in the Kids genre |
| 7–9 | G, PG | TV-Y, TV-Y7, TV-G | |
| 10–12 | G, PG | + TV-PG | any animated series |
| 13–15 | G, PG, PG-13 | + TV-PG | + adventure and sci-fi series |

Movies and series without a US rating (NR) are not shown. Horror, thriller, crime and war are always excluded (for series also news, reality, soap and talk shows).

[← All plugins](../README.md)
