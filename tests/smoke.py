"""Smoke test: load every plugin into the live Lampa web app in headless Chromium
and check that each one starts and does its job.

Expects the repository served at PLUGIN_BASE and sync/server.js at SYNC_URL
(see .github/workflows/check.yml). Screenshots go to SHOTS.
"""
import asyncio
import json
import os
import sys
import urllib.request

from playwright.async_api import async_playwright

LAMPA = os.environ.get('LAMPA_URL', 'https://yumata.github.io/lampa/')
BASE = os.environ.get('PLUGIN_BASE', 'http://127.0.0.1:8090/')
SYNC = os.environ.get('SYNC_URL', 'http://127.0.0.1:8080')
SHOTS = os.environ.get('SHOTS', 'shots')
PLUGINS = ['kids_age.js', 'torrent_button.js', 'neo.js', 'lg_tracks.js', 'profiles.js']

INIT = """
localStorage.setItem('language', 'ru');
localStorage.setItem('plugins', JSON.stringify(%s));
localStorage.setItem('neo_enabled', 'true');
localStorage.setItem('parser_use', 'true');
localStorage.setItem('nsync_url', %s);
""" % (json.dumps([{'url': BASE + p, 'status': 1} for p in PLUGINS]), json.dumps(SYNC))

results = []


def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print('%s %s%s' % ('PASS' if ok else 'FAIL', name, (' — ' + detail) if detail else ''))


async def main():
    os.makedirs(SHOTS, exist_ok=True)
    errors = []

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={'width': 1920, 'height': 1080})

        # only errors coming from our plugins count; Lampa itself logs plenty of its own
        page.on('pageerror', lambda e: errors.append(str(e)) if BASE in (e.stack or '') else None)
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' and BASE in m.text and 'CORS' not in m.text and '?cache=true' not in m.text else None)

        await page.add_init_script(INIT)
        await page.goto(LAMPA, wait_until='domcontentloaded', timeout=60000)

        try:
            await page.wait_for_function(
                "window.appready && window.kids_age_plugin_api && window.torrent_button_plugin && "
                "window.neo_plugin_api && window.lg_tracks_plugin && window.nas_profiles_plugin_api",
                timeout=45000)
            check('all plugins loaded', True)
        except Exception:
            loaded = await page.evaluate("""() => ({kids: !!window.kids_age_plugin_api, torrents: !!window.torrent_button_plugin,
                neo: !!window.neo_plugin_api, lg_tracks: !!window.lg_tracks_plugin, profiles: !!window.nas_profiles_plugin_api})""")
            check('all plugins loaded', False, json.dumps(loaded))

        await page.wait_for_timeout(8000)
        await page.screenshot(path=SHOTS + '/1-home.png')

        check('kids: «Детям» menu item', await page.query_selector('.menu [data-action="kids_age"]'))
        check('profiles: profile menu item', await page.query_selector('.menu [data-action="nas_profiles"]'))
        check('neo: interface enabled', await page.evaluate("document.body.classList.contains('neo')"))
        check('neo: banner on the home screen', await page.query_selector('.activity--active .neo-hero'))

        for key in ['ArrowDown', 'ArrowRight', 'ArrowRight']:
            await page.keyboard.press(key)
            await page.wait_for_timeout(1000)
        await page.wait_for_timeout(3000)
        await page.screenshot(path=SHOTS + '/2-focus.png')

        title = await page.evaluate("(document.querySelector('.neo-hero__title') || {}).textContent || ''")
        check('neo: banner shows the focused movie', title.strip(), title.strip())

        await page.keyboard.press('Enter')
        try:
            await page.wait_for_selector('.full-start-new__buttons', timeout=20000)
            await page.wait_for_timeout(3000)
        except Exception:
            pass
        await page.screenshot(path=SHOTS + '/3-card.png')

        check('torrents: «Торренты» button on the movie card', await page.query_selector('.button--torrent-direct'))

        # profiles: the first device creates the «Основной» profile on the sync server
        await page.wait_for_timeout(2000)
        try:
            profiles = json.load(urllib.request.urlopen(SYNC + '/api/profiles', timeout=5))['profiles']
            check('profiles: profile created on the sync server', any(p['id'] == 'main' for p in profiles), json.dumps(profiles, ensure_ascii=False))
        except Exception as e:
            check('profiles: profile created on the sync server', False, str(e))

        check('no errors from plugins', not errors, '; '.join(errors[:5]))

        await browser.close()

    failed = [r for r in results if not r[1]]
    print('\n%d passed, %d failed' % (len(results) - len(failed), len(failed)))

    # result table on the GitHub Actions run page
    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary, 'a') as f:
            f.write('### Smoke test: Lampa %s\n\n| Check | Result | Details |\n|---|---|---|\n' % os.environ.get('LAMPA_LABEL', ''))
            for name, ok, detail in results:
                f.write('| %s | %s | %s |\n' % (name, '✅' if ok else '❌', detail.replace('|', '/').replace('\n', ' ')[:200]))
            f.write('\n**%d passed, %d failed**\n' % (len(results) - len(failed), len(failed)))
    sys.exit(1 if failed else 0)


asyncio.run(main())
