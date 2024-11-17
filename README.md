# SPC Chart

Welcome to the **KensoBI SPC Chart** panel for **Grafana**. This plugin enables you to easily create statistical process control (SPC) charts, including **Xbar-R**, **XbarS**, and **XmR** charts. It automatically calculates and displays control limits, with options to add your own custom limits. Additionally, you can group your samples into subgroups and aggregate them using methods such as **moving range**, **range**, **mean**, or **standard deviation**.

![Main](https://raw.githubusercontent.com/KensoBI/spc-chart/refs/heads/main/src/img/SPC-chart.png)

## Available Options

- **Xbar-R, XbarS, and XmR Charts:** Create various types of SPC charts with a single click.

- **Automatic Control Limits:** LCL (Lower Control Limit), UCL (Upper Control Limit), and mean are automatically calculated and displayed.

- **Custom Limits:** Add your own limits for more tailored analysis.

- **Subgrouping:** Group your samples into subgroups for analysis.

- **Aggregation:** Aggregate your data by moving range, range, mean, or standard deviation.

## Documentation

Please see the full panel documentation at [KensoBI Docs](https://docs.kensobi.com/panels/spc-chart/).

**NOTE:** The plugin comes with sample provisioned dashboards. Build and start the plugin to see them.


## Building the plugin
1. Install dependencies

   ```bash
   yarn install
   ```

2. Build plugin in development mode and run in watch mode

   ```bash
   yarn run dev
   ```
3. Build plugin in production mode

   ```bash
   yarn run build
   ```
4. Start Grafana docker image
   ```bash
   docker compose up
   ```

## Getting Help

If you have any questions or feedback, you can:

- Create an [issue](https://github.com/KensoBI/spc-panel/issues) to report bugs, issues, and feature suggestions.
- Ask a question on the [KensoBI Discord channel](https://discord.gg/cVKKh7trXU).

Your feedback is always welcome!


## License

This software is distributed under the [Apache License](https://raw.githubusercontent.com/KensoBI/spc-chart/main/LICENSE).


## Notes

Copyright (c) 2024 [Kenso Software](https://kensobi.com)