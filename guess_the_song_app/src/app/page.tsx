'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [players, setPlayers] = useState<any[]>([]);

  useEffect(() => {
    const loadPlayers = async () => {
      const { data, error } = await supabase
        .from('players')
        .select('*');

      if (error) {
        console.error(error);
      } else {
        setPlayers(data || []);
      }
    };

    loadPlayers();
  }, []);

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">
        Supabase Connection Test
      </h1>

      <pre className="bg-gray-100 p-4 rounded">
        {JSON.stringify(players, null, 2)}
      </pre>
    </main>
  );
}
