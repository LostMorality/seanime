<p align="center">
<a href="https://seanime.app/">
<img src="docs/images/seanime-logo.png" alt="preview" width="70px"/>
</a>
</p>

<h1 align="center"><b>Seanime</b></h1>

<p align="center">
<img src="https://s3.seanime.app/sea/img-20260508-090529-ioc20pjr--sq2.webp" alt="preview" width="100%"/>
</p>

<p align="center">
  <a href="https://seanime.app/docs">Documentation</a> |
  <a href="https://github.com/5rahim/seanime/releases">Latest release</a> |
  <a href="https://seanime.app/docs/policies">Copyright</a>
</p>

<div align="center">
  <a href="https://github.com/5rahim/seanime/releases">
    <img src="https://img.shields.io/github/v/release/5rahim/seanime?style=flat-square&color=blue" alt="" />
  </a>
  <a href="https://github.com/5rahim/seanime/releases">
    <img src="https://img.shields.io/github/downloads/5rahim/seanime/total?style=flat-square&color=blue" alt="" />
  </a>
	<a href="https://discord.gg/Aruz7wdAaf">
	  <img src="https://img.shields.io/discord/1224767201551192224?style=flat-square&logo=Discord&color=blue&label=Discord" alt="discord">
	</a>
  <a href="https://github.com/sponsors/5rahim">
    <img src="https://img.shields.io/static/v1?label=Sponsor&style=flat-square&message=%E2%9D%A4&logo=GitHub&color=%23fe8e86" alt="" />
  </a>
</div>


<h5 align="center">
Leave a star if you like the project! ⭐️
</h5>

## What's different in this fork

This is my fork of [Seanime](https://github.com/5rahim/seanime). It isn't an official build. The changes live on the [`discover-improvements`](https://github.com/LostMorality/seanime/tree/discover-improvements) branch ([compare with upstream](https://github.com/5rahim/seanime/compare/main...LostMorality:seanime:discover-improvements)), and you can try them by building that branch (see [Development and Build](#development-and-build)).

| Area | Change |
|---|---|
| Discover | **Hide watched** and **Also hide Planning** switches (on by default), a genre filter on every row, and a **Recommended for You** row based on the genres you watch and how you score them |
| Anime pages | Recommendations skip anime you've already seen and fetch more from AniList when most of the top 8 are hidden |
| Anime pages | The trailer plays in the banner, Steam-style: muted, sound while your mouse is over the header, then it fades back to the banner image when it ends. It can also go below the episodes, be click-to-play, or be turned off |
| Anime cards | A **最新話 / NEW EPISODE** sash across the cover of airing shows you're watching when an episode you haven't seen is out |
| Anime cards | Right-click the **+** (Add to list) button to add as Watching, Planning, Completed, Paused or Dropped. A normal click still adds as Planning |
| My Lists | **Date added (oldest first)** sort |
| Home | **Recent List Activity** row: recently added to Planning, recently completed, recently added, or recently updated |
| Player | **Video Enhancement** menu with contrast, saturation and brightness sliders, and the settings now carry into picture-in-picture |
| Player | Volume boost up to 300% for VideoCore and MpvCore, with Shift+Up / Shift+Down. **Merged upstream** in [#964](https://github.com/5rahim/seanime/pull/964) |
| Plugins | Characters info+ only looks a character up when you hover it, instead of every character on page load, which cuts down on AniList rate limiting ([PR #39](https://github.com/Seanime-contributions/Seanime-Providers/pull/39)) |

The new options are in **Settings › UI** (NEW EPISODE sash, trailer mode), on the Discover page itself, and in **Home › settings** for the new row.

Sent upstream: [#994](https://github.com/5rahim/seanime/issues/994) (Video Enhancement), [#996](https://github.com/5rahim/seanime/issues/996) (Discover), [#964](https://github.com/5rahim/seanime/pull/964) (volume boost, merged).

<details open>
<summary><b>Screenshots</b></summary>

<br>

**Trailer in the banner**

<img src="https://raw.githubusercontent.com/LostMorality/seanime/9d23fe281272a01c92874dd3afc7d3e03aecc443/shots/banner-trailer.png" width="900" alt="Trailer playing in the anime page banner">

**Discover filters and Recommended for You**

<img src="https://raw.githubusercontent.com/LostMorality/seanime/9d23fe281272a01c92874dd3afc7d3e03aecc443/shots/discover-filters-recommended.png" width="900" alt="Discover filter bar and Recommended for You row">

<table>
<tr>
<td align="center"><b>NEW EPISODE sash</b><br><br><img src="https://raw.githubusercontent.com/LostMorality/seanime/9d23fe281272a01c92874dd3afc7d3e03aecc443/shots/new-episode-sash.png" width="220" alt="NEW EPISODE sash on an anime card"></td>
<td align="center"><b>Right-click Add to list</b><br><br><img src="https://raw.githubusercontent.com/LostMorality/seanime/9d23fe281272a01c92874dd3afc7d3e03aecc443/shots/add-to-list-menu.png" width="220" alt="Add to list status menu"></td>
<td align="center"><b>Video Enhancement</b><br><br><img src="https://raw.githubusercontent.com/LostMorality/seanime/9d23fe281272a01c92874dd3afc7d3e03aecc443/shots/video-enhancement-menu.png" width="220" alt="Video Enhancement settings menu"></td>
</tr>
</table>

**Recommendations that skip what you've seen**

<img src="https://raw.githubusercontent.com/LostMorality/seanime/9d23fe281272a01c92874dd3afc7d3e03aecc443/shots/entry-recommendations.png" width="420" alt="Recommendations section with only unwatched anime">

</details>

## About

Seanime is a **media server** with a **web interface** and **desktop app** for managing your local library, streaming anime and reading manga.

> [!IMPORTANT]
>Seanime does not provide, host, or distribute any media content. Users are responsible for obtaining media through legal means and complying with their local laws. Extensions listed on the app are unaffiliated with Seanime and may be removed if they violated copyright laws. </strong>


## Features

- **Cross-platform**: Web interface and desktop app for Windows, Linux, and macOS, companion and mobile server apps for iOS and Android
- **Seanime Denshi**: Desktop client with built-in libmpv-based video player (support for SSA/ASS subtitles, shaders, and more)
- **Seanime Tenji**: Companion app for iOS and Android to browse your library, manage your AniList, stream content, and enjoy offline access. Connect to your existing Seanime server or host your own directly on your mobile device with the Mobile Server app
- **AniList Integration**: Browse and manage your lists, discover anime and manga
- **Custom Sources**: Support for adding non-AniList anime and manga series 
- **Library Management**: Fast and smart scanning of local files without strict naming conventions or folder structures
- **Torrent Integration**: Built-in torrent search engine via extensions and downloading support with qBittorrent, Transmission, Torbox, Real-Debrid, AllDebrid and Premiumize
- **Torrent Streaming**: Stream torrents directly to the media player without waiting for downloads (supports Bittorrent, Torbox, Real-Debrid, AllDebrid and Premiumize)
- **Online Streaming**: Watch anime from online sources directly within the app via extensions
- **Auto Downloader**: Automatically track and download new episodes with customizable filters and advanced features (prioritization, scoring, delay, etc.)
- **Extension Marketplace**: In-app repository to install and manage extensions for online streaming, manga sources, and torrent providers
- **Manga Reader**: Read chapters from your local library or via extensions with a unified interface
- **Transcoding & Direct Play**: Stream your library to any device web browser with on-the-fly transcoding or direct play
- **External Player Support**: Seamless integration with MPV, VLC, and MPC-HC on desktop
- **Mobile Player Integration**: Open files and streams in mobile players (Outplayer, VLC, etc.) via intents or deep links
- **Playlists**: Create and manage playlists for a seamless binge watching experience
- **Customizable UI**: Personalize the interface with color themes, background images, and layout options
- **Discord Rich Presence**: Display your watching activity automatically
- **Offline Mode**: Access your anime and manga library without an internet connection
- **Schedule**: Track upcoming releases and missed episodes

## Get started

Read the installation guide to set up Seanime on your device.

<p align="center">
<a href="https://seanime.app/docs" style="font-size:18px;" align="center">
How to install Seanime
</a>
</p>

<br>

## Goal

This is a one-person project and may not meet every use case. If it doesn’t fully fit your needs, other tools might be a better match.

### Not planned

- Built-in support for other trackers such as MyAnimeList, Trakt, SIMKL, etc.
- Built-in support for other media players
- Built-in localization (translations)


Consider sponsoring or sharing the project if you want to see more features implemented.

## Sponsors

The maintenance of this project is made possible by the sponsors.

<p align="center">
<!-- real-sponsors --><a href="https://github.com/aquaryuo"><img src="https:&#x2F;&#x2F;github.com&#x2F;aquaryuo.png" width="60px" alt="User avatar: aquaryuo" /></a><!-- real-sponsors -->
<!-- real-sponsors --><a href="https://github.com/osayed0001"><img src="https:&#x2F;&#x2F;github.com&#x2F;osayed0001.png" width="60px" alt="User avatar: osayed0001" /></a><!-- real-sponsors -->
</p>

## Tech stack

* Server: [Go](https://go.dev/)
* Frontend: [React](https://reactjs.org/), [Rsbuild/Rspack](https://rsbuild.rs/), [Tanstack Router](https://tanstack.com/router)
* Seanime Denshi: [Electron](https://www.electronjs.org/)

## Development and Build

Building from source is straightforward, you'll need [Node.js](https://nodejs.org/en/download) and [Go](https://go.dev/doc/install) installed on your system.
Development and testing might require additional configuration.

[Read more here](https://github.com/5rahim/seanime/blob/main/DEVELOPMENT_AND_BUILD.md)

<br>

<br>

> [!NOTE]
> For copyright-related requests, please contact the maintainer using the contact information provided on [the website](https://seanime.app/docs/policies).
