import React, { useCallback, useEffect, useRef, useState } from 'react';

import 'chartjs-adapter-moment';

import { PopoverClose } from '@radix-ui/react-popover';
import { CategoryScale, TimeScale } from 'chart.js';
import { Chart, defaults } from 'chart.js/auto';
import { CalendarDaysIcon, DownloadIcon, InfoIcon, KeyIcon } from 'lucide-react';
import moment from 'moment';
import { nip04, NostrEvent, SimplePool, VerifiedEvent } from 'nostr-tools';
import { SubCloser } from 'nostr-tools/lib/types/abstract-pool';
import { Line } from 'react-chartjs-2';
import { CSVLink } from 'react-csv';
import { UAParser } from 'ua-parser-js';
import { useStatePersist } from 'use-state-persist';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DataEntry } from '@/lib/data-entry';
import { NostrlyticsData } from '@/lib/nostrlytics-data';
import { countDataByDay, dateBucketMillis } from '@/lib/utils';

import { connectGeneratedKeys } from '../lib/connect-generated-keys';
import { connectKeyInput } from '../lib/connect-key-input';
import { trimPublicKey } from '../lib/trim-public-key';
import { NostrAccountConnection } from '../types/nostr-account-connection';
import { NostrlyticsConfig } from '../types/nostrlytics-config';

Chart.register(CategoryScale);
Chart.register(TimeScale);

defaults.maintainAspectRatio = false;
defaults.responsive = true;
///defaults.plugins.title.display = false;
//defaults.plugins.title.align = 'start';
//defaults.plugins.title.color = 'black';
new Date().getTimezoneOffset() * 60 * 1000;
const compactNumberFormatter = Intl.NumberFormat(navigator.language, { notation: 'compact' });
const dateFormatter = new Intl.DateTimeFormat(navigator.language, {});

export default function Analytics() {
  const [pool, setPool] = useState<SimplePool | null>();
  const [impressions, setImpressions] = useState<DataEntry[]>([]);
  const [clickOuts, setClickOuts] = useState<DataEntry[]>([]);

  const [summedImpressions, setSummedImpressions] = useState<{ x: string; y: number }[]>([]);
  const [summedClickOuts, setSummedClickOuts] = useState<{ x: string; y: number }[]>([]);

  const [totalImpressions, setTotalImpressions] = useState<string>('0');

  const [impressionsByReferrer, setImpressionsByReferrer] = useState<
    { referrer: string; count: number }[]
  >([]);
  const [impressionsByPage, setImpressionsByPage] = useState<{ page: string; count: number }[]>([]);
  const [impressionsByBrowser, setImpressionsByBrowser] = useState<
    { browser: string; count: number }[]
  >([]);

  const [clicksByUrl, setClicksByUrl] = useState<{ url: string; count: number }[]>([]);

  const [startDate, setStartDate] = useState<Date>(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const [endDate, setEndDate] = useState<Date>(new Date());

  const [hasLoaded, setHasLoaded] = useState<boolean>(false);

  const [nostrAccountLabel, setNostrAccountLabel] = useState<string>('No Nostr Account');

  const [nostrAccountConnection, setNostrAccountConnection] = useStatePersist<
    NostrAccountConnection | undefined
  >('nostr-account-connection');

  const [csvData, setCsvData] = useState<(string | undefined)[][]>([[]]);

  const subscriptionReference = useRef<SubCloser | undefined>();

  const nostrKeysButtonClassName =
    'text-body3 rounded-md bg-violet-500 px-8 py-1 hover:bg-violet-600 active:scale-90';

  const nostrlyticsConfig = (window as never)['nostrlyticsConfig'] as NostrlyticsConfig;

  const decryptEventContent = async (
    event: VerifiedEvent,
    accountConnection: NostrAccountConnection | null | undefined
  ) => {
    if (!accountConnection) {
      throw new Error('No nostr account connection');
    }

    switch (accountConnection.type) {
      case 'input-keys':
      case 'generated-keys': {
        if (!accountConnection.privateKey) {
          throw new Error('No private key in connection');
        }
        return await nip04.decrypt(accountConnection.privateKey, event.pubkey, event.content);
      }
      default: {
        throw new Error('Invalid nostr account connection');
      }
    }
  };

  const onNostrEvent = useCallback(
    async (event: NostrEvent) => {
      if (event.kind === 4) {
        //console.log(event);
        try {
          const decryptedJsonString = await decryptEventContent(
            event as VerifiedEvent,
            nostrAccountConnection
          );
          if (!decryptedJsonString) {
            return;
          }

          const decryptedData = JSON.parse(decryptedJsonString) as NostrlyticsData;

          if (decryptedData.kind !== 'nstrly-event') {
            return;
          }

          if (decryptedData.type === 'page-impression') {
            setImpressions((previous) => [
              ...previous,
              {
                dateBucket: dateBucketMillis(event.created_at * 1000),
                timestamp: event.created_at,
                data: decryptedData
              }
            ]);
          } else if (decryptedData.type === 'click-out') {
            setClickOuts((previous) => [
              ...previous,
              {
                dateBucket: dateBucketMillis(event.created_at * 1000),
                timestamp: event.created_at,
                data: decryptedData
              }
            ]);
          }
        } catch {
          /* noop */
        }
      }
    },
    [nostrAccountConnection]
  );

  const onEose = useCallback(() => {
    console.log('End of stream');
    setHasLoaded(true);
  }, []);

  const onInputKeyClicked = useCallback(() => {
    const connect = connectKeyInput();
    setNostrAccountConnection(connect);
    console.log(connect);
  }, [setNostrAccountConnection]);

  const onGenerateKeysClicked = useCallback(() => {
    const connect = connectGeneratedKeys();
    setNostrAccountConnection(connect);
    console.log(connect);
  }, [setNostrAccountConnection]);

  const onClearAccountClicked = useCallback(() => {
    setNostrAccountConnection(undefined);
  }, [setNostrAccountConnection]);

  useEffect(() => {
    setHasLoaded(false);
    setImpressions([]);
    setClickOuts([]);
    setHasLoaded(true);
  }, [nostrAccountConnection]);

  // setup relay pool
  useEffect(() => {
    const relays = nostrlyticsConfig.relays || [];
    const _pool = new SimplePool();
    //TODO: maybe useRef
    setPool(_pool);

    return () => {
      console.log('Cleaning up pool...');
      _pool.close(relays);
    };
  }, [nostrlyticsConfig.relays]);

  useEffect(() => {
    let label = 'No Nostr Account';
    if (nostrAccountConnection) {
      switch (nostrAccountConnection.type) {
        case 'input-keys': {
          label = 'Input Key: ';
          break;
        }
        case 'generated-keys': {
          label = 'Generated Keys: ';
          break;
        }
      }
      label += trimPublicKey(nostrAccountConnection.publicKey);
    }

    setNostrAccountLabel(label);

    return () => {
      /* noop */
    };
  }, [nostrAccountConnection]);

  useEffect(() => {
    if (!pool) {
      return;
    }

    if (subscriptionReference && subscriptionReference.current) {
      subscriptionReference.current.close();
      subscriptionReference.current = undefined;
    }

    if (!nostrAccountConnection) {
      return;
    }

    const relays = nostrlyticsConfig.relays || [];
    const myPublicKey = nostrAccountConnection.publicKey || '';

    const startTimestamp = Math.trunc(moment(startDate).startOf('day').valueOf() / 1000);
    const endTimestamp = Math.trunc(moment(endDate).endOf('day').valueOf() / 1000);

    setHasLoaded(false);
    subscriptionReference.current = pool.subscribeMany(
      relays,
      [
        {
          kinds: [4],
          '#p': [myPublicKey],
          since: startTimestamp,
          until: endTimestamp
        }
      ],
      {
        onevent: onNostrEvent,
        oneose: onEose
      }
    );
  }, [
    pool,
    nostrAccountConnection,
    nostrlyticsConfig.relays,
    startDate,
    endDate,
    onNostrEvent,
    onEose
  ]);

  // eslint-disable-next-line sonarjs/cognitive-complexity
  useEffect(() => {
    if (!hasLoaded) {
      return () => {
        /* noop */
      };
    }

    console.log('Calculating...');

    const impressionsByDay = countDataByDay(impressions);
    const totalImpressions = impressionsByDay.reduce(
      (accumulator, current) => accumulator + current.y,
      0
    );

    const _impressionsByReferrer: { referrer: string; count: number }[] = [];
    const _impressionsByPage: { page: string; count: number }[] = [];
    const _impressionsByBrowser: { browser: string; count: number }[] = [];
    const _clicksByUrl: { url: string; count: number }[] = [];
    let index;

    const _csvData: (string | undefined)[][] = [];

    for (const impression of impressions) {
      const referrer = impression.data.referrer || 'Direct';
      const page = new URL(impression.data.location).pathname;

      const userAgent = new UAParser(impression.data.userAgent);
      const browser =
        userAgent.getBrowser().name +
        ' (' +
        userAgent.getOS().name +
        ' ' +
        userAgent.getOS().version +
        ')';

      _csvData.push([
        moment(impression.timestamp * 1000).toISOString(),
        impression.data.type,
        userAgent.getBrowser().name,
        userAgent.getBrowser().version,
        userAgent.getOS().name,
        userAgent.getOS().version,
        impression.data.language,
        impression.data.location,
        referrer,
        ''
      ]);

      index = _impressionsByReferrer.findIndex((item) => item.referrer === referrer);
      if (index === -1) {
        _impressionsByReferrer.push({ referrer, count: 1 });
      } else {
        _impressionsByReferrer[index].count++;
      }

      index = _impressionsByPage.findIndex((item) => item.page === page);
      if (index === -1) {
        _impressionsByPage.push({ page, count: 1 });
      } else {
        _impressionsByPage[index].count++;
      }

      index = _impressionsByBrowser.findIndex((item) => item.browser === browser);
      if (index === -1) {
        _impressionsByBrowser.push({ browser, count: 1 });
      } else {
        _impressionsByBrowser[index].count++;
      }
    }

    for (const clickOut of clickOuts) {
      const url = clickOut.data.clickOutUrl;
      if (!url) {
        continue;
      }

      const userAgent = new UAParser(clickOut.data.userAgent);

      _csvData.push([
        moment(clickOut.timestamp * 1000).toISOString(),
        clickOut.data.type,
        userAgent.getBrowser().name,
        userAgent.getBrowser().version,
        userAgent.getOS().name,
        userAgent.getOS().version,
        clickOut.data.language,
        clickOut.data.location,
        '',
        url
      ]);

      index = _clicksByUrl.findIndex((item) => item.url === url);
      if (index === -1) {
        _clicksByUrl.push({ url, count: 1 });
      } else {
        _clicksByUrl[index].count++;
      }
    }

    _impressionsByReferrer.sort((a, b) => b.count - a.count);
    _impressionsByPage.sort((a, b) => b.count - a.count);
    _impressionsByBrowser.sort((a, b) => b.count - a.count);
    _clicksByUrl.sort((a, b) => b.count - a.count);

    _csvData.sort((a, b) => {
      const momentA = moment(a[0]);
      const momentB = moment(b[0]);
      if (momentA.isBefore(momentB)) {
        return -1;
      }
      if (momentA.isAfter(momentB)) {
        return 1;
      }
      return 0;
    });

    _csvData.unshift([
      'date',
      'type',
      'browser',
      'browserVersion',
      'os',
      'osVersion',
      'language',
      'location',
      'referrer',
      'clickOutUrl'
    ]);

    setCsvData(() => _csvData);

    // top 5
    _impressionsByReferrer.length =
      _impressionsByPage.length =
      _impressionsByBrowser.length =
      _clicksByUrl.length =
        5;

    const clickOutsByDay = countDataByDay(clickOuts);

    setImpressionsByReferrer(() => _impressionsByReferrer);
    setImpressionsByPage(() => _impressionsByPage);
    setImpressionsByBrowser(() => _impressionsByBrowser);
    setClicksByUrl(() => _clicksByUrl);

    setSummedImpressions(() => impressionsByDay);
    setTotalImpressions(() => compactNumberFormatter.format(totalImpressions));

    setSummedClickOuts(() => clickOutsByDay);
    return () => {
      /* noop */
    };
  }, [hasLoaded, impressions, clickOuts]);

  const showKeysPopover = (
    <Popover>
      <PopoverTrigger asChild>
        <Button className='w-full justify-start text-left font-normal' id='keys' variant='ghost'>
          <InfoIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent align='start' className='w-auto p-0'>
        <div
          data-side='bottom'
          data-align='start'
          data-state='open'
          role='dialog'
          id='radix-:r1:'
          className='z-50 w-auto rounded-md border bg-popover p-0 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2'
        >
          <div className='rdp p-3'>
            <div className='flex flex-col gap-2'>
              <div className='font-bold'>Your public key</div>
              <div className='font-mono text-sm'>{nostrAccountConnection?.publicKey}</div>
              <div className='font-bold'>Your private key</div>
              <div className='font-mono text-sm'>{nostrAccountConnection?.privateKey}</div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <div className='flex min-h-screen flex-col'>
      <header className='flex h-16 shrink-0 items-center border-b px-6'>
        <div className='flex items-center gap-2'>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                className='w-full justify-start text-left font-normal'
                id='keys'
                variant='outline'
              >
                <KeyIcon className='mr-1 h-4 w-4 -translate-x-1' />
                <span>{nostrAccountLabel}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align='start' className='w-auto p-0'>
              <div
                data-side='bottom'
                data-align='start'
                data-state='open'
                role='dialog'
                id='radix-:r1:'
                className='z-50 w-auto rounded-md border bg-popover p-0 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2'
              >
                <div className='rdp p-3'>
                  <div className='flex flex-col gap-2'>
                    <PopoverClose onClick={onInputKeyClicked} className={nostrKeysButtonClassName}>
                      Input Private Key
                    </PopoverClose>
                    <PopoverClose
                      onClick={onGenerateKeysClicked}
                      className={nostrKeysButtonClassName}
                    >
                      Generate New Private Key
                    </PopoverClose>
                    <PopoverClose
                      onClick={onClearAccountClicked}
                      className='text-body3 mt-2 rounded-md bg-red-500 px-8 py-1 hover:bg-red-600 active:scale-90'
                    >
                      Clear Account Data
                    </PopoverClose>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          {nostrAccountConnection && nostrAccountConnection.publicKey ? showKeysPopover : ''}
        </div>
        <div className='ml-auto flex items-center gap-2'>
          <CSVLink data={csvData} filename='nostrlytics.csv'>
            <Button
              className='w-full justify-start text-left font-normal'
              id='csvData'
              variant='ghost'
            >
              <DownloadIcon />
            </Button>
          </CSVLink>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                className='w-full justify-start text-left font-normal'
                id='date'
                variant='outline'
              >
                <CalendarDaysIcon className='mr-1 h-4 w-4 -translate-x-1' />
                <span>
                  {dateFormatter.format(startDate)} - {dateFormatter.format(endDate)}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align='start' className='w-auto p-0'>
              <Calendar
                initialFocus
                mode='range'
                numberOfMonths={1}
                disabled={!hasLoaded}
                selected={{ from: startDate, to: endDate }}
                onSelect={(range) => {
                  if (range && hasLoaded) {
                    range.from ||= startDate;
                    range.to ||= endDate;
                    setHasLoaded(false);
                    setStartDate(range.from);
                    setEndDate(range.to);
                    setImpressions([]);
                    setClickOuts([]);
                  }
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
      </header>
      <main className='flex-1 bg-gray-100/40 p-6 dark:bg-gray-800/40 md:p-10'>
        <div className='mx-auto grid max-w-6xl gap-6'>
          <div>
            <Card>
              <CardHeader className='grid gap-6 md:grid-cols-2'>
                <div>
                  <CardTitle>Page Impressions</CardTitle>
                  <CardDescription>Total page views and impressions over time</CardDescription>
                </div>
                <div className='end-0 flex flex-col gap-2'>
                  <div className='text-right text-4xl font-bold'>{totalImpressions}</div>
                  <div className='text-right text-gray-500 dark:text-gray-400'>
                    Total Impressions
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div
                  style={{ position: 'relative', margin: 'auto', height: '40vh', width: '80vw' }}
                >
                  <Line
                    data={{
                      datasets: [
                        {
                          label: 'Impressions',
                          data: summedImpressions,
                          fill: false,
                          borderColor: 'rgb(75, 192, 192)',
                          tension: 0.1
                        },
                        {
                          label: 'Clickouts',
                          data: summedClickOuts,
                          fill: false,
                          borderColor: 'rgb(255, 99, 132)',
                          tension: 0.1
                        }
                      ]
                    }}
                    options={{
                      plugins: {
                        tooltip: {
                          callbacks: {
                            title: (tooltipItem) => {
                              return moment(tooltipItem[0].parsed.x).format('LL');
                            }
                          }
                        }
                      },

                      scales: {
                        x: {
                          type: 'timeseries',
                          time: {
                            unit: 'day'
                          }
                        }
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
          <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-4'>
            <Card>
              <CardHeader>
                <CardTitle>Top Referrers</CardTitle>
                <CardDescription>Sources driving the most traffic</CardDescription>
              </CardHeader>
              <CardContent>
                <div className='grid gap-4 text-sm'>
                  {impressionsByReferrer.map(({ referrer, count }) => (
                    <div key={referrer} className='flex items-center'>
                      <div>{referrer}</div>
                      <div className='ml-auto font-semibold'>
                        {compactNumberFormatter.format(count)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Top Pages</CardTitle>
                <CardDescription>Most visited pages on your site</CardDescription>
              </CardHeader>
              <CardContent>
                <div className='grid gap-4 text-sm'>
                  {impressionsByPage.map(({ page, count }) => (
                    <div key={page} className='flex items-center'>
                      <div>{page}</div>
                      <div className='ml-auto font-semibold'>
                        {compactNumberFormatter.format(count)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Top User Agents</CardTitle>
                <CardDescription>Browsers and devices used to access your site</CardDescription>
              </CardHeader>
              <CardContent>
                <div className='grid gap-4 text-sm'>
                  {impressionsByBrowser.map(({ browser, count }) => (
                    <div key={browser} className='flex items-center'>
                      <div>{browser}</div>
                      <div className='ml-auto font-semibold'>
                        {compactNumberFormatter.format(count)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Top Clicked Links</CardTitle>
                <CardDescription>
                  External Links on your site, that have been clicked
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className='grid gap-4 text-sm'>
                  {clicksByUrl.map(({ url, count }) => (
                    <div key={url} className='flex items-center'>
                      <div>{url}</div>
                      <div className='ml-auto font-semibold'>
                        {compactNumberFormatter.format(count)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
