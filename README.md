# SPC Chart
![Dynamic JSON Badge](https://img.shields.io/badge/dynamic/json?logo=grafana&query=$.version&url=https://grafana.com/api/plugins/kensobi-spc-panel&label=Marketplace&prefix=v&color=F47A20)
![Grafana](https://img.shields.io/badge/Grafana-11.6%2B-orange?logo=grafana)

The SPC Chart panel automatically calculates and displays control limits for **XmR**, **Xbar-R**, and **Xbar-S** charts — so you can monitor process stability, detect special cause variation, and make data-driven decisions in real time.

![SPC Chart with variable limits and custom control lines](src/img/spc-chart-variable-v2.png)

## Why SPC Chart?

Control charts are the foundation of statistical process control. They separate **common cause** variation (normal process behavior) from **special cause** variation (signals that something has changed). This plugin makes that analysis effortless:

- **Automatic control limits** — LCL, UCL, and Mean are calculated and displayed automatically based on the selected chart type
- **Multiple chart types** — XmR for individual measurements, Xbar-R for small subgroups, Xbar-S for larger subgroups
- **Custom control lines** — add Nominal, LSL, USL, or any custom reference line with static values or dynamic series lookup
- **Fill regions** — visually highlight zones between control lines to show acceptable process ranges


![SPC Chart dashboard showing all chart types](src/img/spc-charts-v2.png)

## Built for Grafana

SPC Chart is built using Grafana's native visualization components. This means it inherits the look, feel, and behavior you already know:

- **Native theming** — automatically adapts to light and dark mode
- **Standard panel options** — legend placement, tooltip behavior, and field overrides work just like any other Grafana panel
- **Works with any data source** — use it with SQL databases, Prometheus, InfluxDB, CSV files, or any other Grafana data source

## Features

| Feature | Description |
|---------|-------------|
| XmR charts | Individual (X) and Moving Range (mR) charts for single measurements |
| Xbar-R charts | Subgroup mean (X-bar) and Range (R) charts for small subgroups |
| Xbar-S charts | Subgroup mean (X-bar) and Standard Deviation (S) charts for larger subgroups |
| Automatic control limits | LCL, UCL, and Mean calculated from the data using standard SPC formulas |
| Custom control lines | Add Nominal, LSL, USL, or custom lines with static values or dynamic series lookup |
| Subgrouping | Group consecutive measurements into subgroups of size 2-25 |
| Aggregation | Aggregate raw data by moving range, range, mean, or standard deviation |
| Fill regions | Color-fill areas between control lines to highlight process zones |
| Alerting support | Grafana alerting integration with alert state annotations on the chart |
| Custom annotations | Create, edit, and delete annotations directly on the chart |
| Threshold visualization | Display alert thresholds alongside SPC control limits |
| Dashboard variables | Control subgroup size across multiple panels with a single `subgroupSize` variable |
| Feature queries | Exclude reference queries from SPC calculations |

## Use Cases

- **Manufacturing quality** — monitor process parameters and detect shifts before they produce defects
- **IT operations** — track response times, error rates, or throughput to distinguish real incidents from normal variation
- **Laboratory analysis** — control measurement systems and reagent performance over time
- **Supply chain** — monitor delivery times, fill rates, or inventory levels for process stability
- **Healthcare** — track clinical metrics and patient outcomes with statistical rigor

## Requirements

- Grafana **11.6.10** or later

## Getting Started

1. Install the plugin from the Grafana Plugin Catalog
2. Add a new panel and select **SPC Chart** as the visualization
3. Configure a query that returns time series data (a time field and one or more numeric value fields)
4. Select a **Chart Type** (XmR, Xbar-R, or Xbar-S) to automatically calculate control limits

The plugin comes with sample provisioned dashboards. Build and start the plugin to see them.

## Documentation

For detailed documentation, configuration guides, and formula references, see the [full documentation](https://docs.kensobi.com/panels/spc-chart/).

## Part of the KensoBI SPC Suite

SPC Chart is part of a growing family of **Statistical Process Control** plugins for Grafana by Kenso Software:

**[SPC Histogram Panel](https://github.com/KensoBI/spc-histogram)** — Distribution analysis with histograms, bell curves, and a built-in statistics table showing Cp, Cpk, Pp, and Ppk. Use it to understand process capability: is your process producing results within specification limits?

**[SPC Pareto Panel](https://github.com/KensoBI/spc-pareto)** — Pareto analysis with automatic sorting, cumulative percentage lines, and 80/20 threshold highlighting. Use it to identify the vital few factors contributing to defects or issues.

**[SPC CAD Panel](https://github.com/KensoBI/spc-cad)** — Brings 3D geometry into the picture, letting you bind the data from control charts and histograms to physical features on your parts.

## Development Setup

### Prerequisites

- Node.js (LTS version recommended)
- Yarn
- Docker (for local Grafana instance)

### Installation

1. Clone the repository

   ```bash
   git clone https://github.com/KensoBI/spc-chart.git
   cd spc-chart
   ```

2. Install dependencies

   ```bash
   yarn install
   ```

### Development Workflow

1. **Build plugin in development mode with watch**

   ```bash
   yarn run dev
   ```

2. **Run Grafana locally**

   ```bash
   docker compose up
   ```

   Access Grafana at `http://localhost:3000` (default credentials: admin/admin)

3. **Build plugin for production**

   ```bash
   yarn run build
   ```

### Testing

```bash
# Run tests in watch mode
yarn run test

# Run tests once (CI mode)
yarn run test:ci
```

## Contributing

We welcome contributions, feedback, and feature requests!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`yarn run test:ci`)
5. Commit your changes
6. Push to your fork
7. Open a Pull Request

Please open an [issue](https://github.com/KensoBI/spc-chart/issues) to discuss major changes before submitting a PR.

## License

This software is distributed under the [Apache License 2.0](LICENSE).

## Support

If you have any questions or feedback, you can:

- Create an [issue](https://github.com/KensoBI/spc-chart/issues) to report bugs, issues, and feature suggestions.
- Ask a question on the [KensoBI Discord channel](https://discord.gg/cVKKh7trXU).
- Grafana Community: https://community.grafana.com/
