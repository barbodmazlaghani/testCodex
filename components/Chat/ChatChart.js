import React, { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';

// Custom plugin to draw values on each bar
const valueLabelPlugin = {
  id: 'valueLabelPlugin',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    chart.data.datasets.forEach((dataset, i) => {
      const meta = chart.getDatasetMeta(i);
      if (!meta.hidden) {
        meta.data.forEach((element, index) => {
          const value = dataset.data[index];
          if (value === undefined || value === null) return;
          const pos = element.tooltipPosition();
          ctx.save();
          ctx.fillStyle = '#000';
          ctx.font = '12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(value, pos.x, pos.y - 2);
          ctx.restore();
        });
      }
    });
  },
};

Chart.register(...registerables);
Chart.register(valueLabelPlugin);

const ChatChart = ({ data }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !data) return;
    let chartInstance;
    try {
      chartInstance = new Chart(canvasRef.current, {
        type: data.chart_type || 'bar',
        data: {
          labels: data.labels,
          datasets: data.datasets,
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: true },
            title: { display: !!data.title, text: data.title },
          },
        },
      });
    } catch (e) {
      console.error('Error rendering chart', e);
    }
    return () => {
      if (chartInstance) chartInstance.destroy();
    };
  }, [data]);

  return (
    <div style={{ width: '100%', height: '300px' }}>
      <canvas ref={canvasRef}></canvas>
    </div>
  );
};

export default ChatChart;
