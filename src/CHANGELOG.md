# Changelog

## 2.0.2
**New Features:**
- **Complete panel rewrite** for improved performance and functionality.
- **Added support for XmR chart** creation.
- Added support for **Custom Control Lines** to pull dynamic values from **Feature Series**.
- **Brand New SPC Editor**: A completely redesigned editor for setting up and customizing SPC charts with an intuitive user interface.
- **Threshold Colors:** Ability to add color thresholds to every control line for better visualization.
- **Multiple Series Support:** Enhanced functionality to handle multiple data series.s
- **Customization Options:**
	- Customization of legend, tooltip, axis, and graph styles.
	- Introduced a **subgroupSize** dashboard variable to control subgroup size across multiple panels.

**Enhancements:**

- **Improved SPC calculations**: Enhanced accuracy in statistical process control.

**Changes:**

- **License Update**: Changed from Apache 2.0 to **AGPL-3.0-only**.
  
**Breaking Changes:**
- Dashboards will automatically migrate settings from v1 to v2. However, thresholds **will need to be reapplied manually**. 
- Support for Grafana 10 and earlier has been discontinued.

**Compatibility:**

- Now supports **Grafana 11**.

## 1.0.3 (2024-04-16)

### Bug fixes
- Compatibility issue with Grafana 10.4.x (undefined reading 'Area') has been resolved.
- Bug with displaying colors in constants has been fixed.

### Features and enhancements
- Ability to enter custom Sample size value has been added.
- New chart display styles: lines, smooth line, points, bars.
- Example demonstrating how to build a SQL query and use constants on a chart. See [documentation](https://docs.kensobi.com/panels/spc) for more information.


## 1.0.2 (2024-01-20)

- Fix scaling of panel options.
- Fix deprecated values.
- Add backward compatibility to Grafana >=9.5.7.
- Add ability to enter additional constants columns taken from the database using SQL entered as Table. See [documentation](https://docs.kensobi.com/panels/spc) for more information.

