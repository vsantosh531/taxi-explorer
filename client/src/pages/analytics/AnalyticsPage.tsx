import { useMemo, useState } from 'react';
import { sql } from '@databricks/appkit-ui/js';
import {
  useAnalyticsQuery,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  BarChart,
  LineChart,
  DataTable,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Input,
  Skeleton,
  Button,
} from '@databricks/appkit-ui/react';
import { exportRows, type ExportFormat } from '../../lib/export';
import { ZipMultiSelect } from '../../components/ZipMultiSelect';

export function AnalyticsPage() {
  const [start, setStart] = useState('2016-02-01');
  const [end, setEnd] = useState('2016-02-29');

  const [selectedZips, setSelectedZips] = useState<string[]>([]);

  const parameters = useMemo(
    () => ({
      start_date: sql.date(start),
      end_date: sql.date(end),
      zip: sql.string(selectedZips.join(',')),
    }),
    [start, end, selectedZips],
  );

  const noParams = useMemo(() => ({}), []);
  const { data: zips } = useAnalyticsQuery('zip_options', noParams);

  const { data: kpi, loading: kpiLoading, error: kpiError } = useAnalyticsQuery('kpis', parameters);
  const row = kpi?.[0];

  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const { data: trips, loading: tripsLoading } = useAnalyticsQuery('trip_details', parameters);
  const handleExport = () => {
    if (!trips?.length) return;
    const zipLabel =
      selectedZips.length === 0
        ? 'all-zips'
        : selectedZips.length <= 3
          ? selectedZips.join('-')
          : `${selectedZips.length}-zips`;
    exportRows(trips, exportFormat, `trip-details_${start}_to_${end}_${zipLabel}_est`);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Analytics</h2>

      <div className="flex flex-wrap items-start gap-4">
        <label className="flex flex-col text-sm gap-1">
          Start date
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="flex flex-col text-sm gap-1">
          End date
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
        <ZipMultiSelect
          options={zips?.map((r) => String(r.zip)) ?? []}
          selected={selectedZips}
          onChange={setSelectedZips}
        />
      </div>

      {kpiError && <div className="text-destructive bg-destructive/10 p-3 rounded-md">Error: {kpiError}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Total trips</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">
            {kpiLoading ? <Skeleton className="h-8 w-24" /> : Number(row?.total_trips ?? 0).toLocaleString()}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Average fare</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">
            {kpiLoading ? <Skeleton className="h-8 w-24" /> : `$${Number(row?.avg_fare ?? 0).toFixed(2)}`}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Trips by hour</CardTitle></CardHeader>
        <CardContent>
          <BarChart queryKey="trips_by_hour" parameters={parameters} xKey="hr" yKey="trips" orientation="vertical" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Trips per day</CardTitle></CardHeader>
        <CardContent>
          <LineChart queryKey="trips_by_day" parameters={parameters} xKey="day" yKey="trips" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Trips by fare range</CardTitle></CardHeader>
        <CardContent>
          <BarChart queryKey="trips_by_fare_range" parameters={parameters} xKey="fare_range" yKey="trips" orientation="vertical" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Trip details</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as ExportFormat)}>
              <SelectTrigger className="w-32" aria-label="Export format"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleExport} disabled={tripsLoading || !trips?.length}>Export</Button>
            <span className="text-xs text-muted-foreground">Times in US Eastern. Exports the rows loaded (up to 200).</span>
          </div>
          <DataTable queryKey="trip_details" parameters={parameters} pageSize={10} />
        </CardContent>
      </Card>
    </div>
  );
}
