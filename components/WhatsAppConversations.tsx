import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback } from './ui/avatar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { LoadingState, ErrorState } from './ui/loading-state';
import { Skeleton } from './ui/skeleton';

interface WhatsAppConversation {
  id: string;
  remote_jid: string;
  message_type: string;
  content: string;
  direction: 'inbound' | 'outbound';
  timestamp: string;
  sender_name: string;
  created_at: string;
}

interface WhatsAppMetrics {
  total_messages: number;
  inbound_messages: number;
  outbound_messages: number;
  unique_customers: number;
  date: string;
}

export function WhatsAppConversations() {
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [metrics, setMetrics] = useState<WhatsAppMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);

  useEffect(() => {
    loadConversations();
    loadMetrics();
  }, []);

  const loadConversations = async () => {
    try {
      setError(null);
      const { data, error } = await supabase
        .from('whatsapp_conversations')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error loading conversations:', error);
        setError('Error al cargar las conversaciones');
        return;
      }
      setConversations((data || []) as unknown as WhatsAppConversation[]);
    } catch (error) {
      console.error('Error loading conversations:', error);
      setError('Error al conectar con la base de datos');
    }
  };

  const loadMetrics = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_daily_metrics')
        .select('*')
        .order('date', { ascending: false })
        .limit(7);

      if (error) {
        console.error('Error loading metrics:', error);
        return;
      }
      setMetrics((data || []) as WhatsAppMetrics[]);
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupConversationsByCustomer = () => {
    const grouped = conversations.reduce((acc, conv) => {
      const customerNumber = conv.remote_jid.replace('@s.whatsapp.net', '');
      if (!acc[customerNumber]) {
        acc[customerNumber] = {
          number: customerNumber,
          name: conv.sender_name || 'Cliente',
          messages: [],
          lastMessage: conv.timestamp
        };
      }
      acc[customerNumber].messages.push(conv);
      if (new Date(conv.timestamp) > new Date(acc[customerNumber].lastMessage)) {
        acc[customerNumber].lastMessage = conv.timestamp;
      }
      return acc;
    }, {} as Record<string, any>);

    return Object.values(grouped).sort((a: any, b: any) =>
      new Date(b.lastMessage).getTime() - new Date(a.lastMessage).getTime()
    );
  };

  const formatPhoneNumber = (number: string) => {
    return number.replace(/(\d{2})(\d{4})(\d{4})/, '+$1 $2-$3');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <div className="space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-4 border border-border rounded-lg">
              <div className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/4" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => {
      setLoading(true);
      loadConversations();
      loadMetrics();
    }} />;
  }

  const customers = groupConversationsByCustomer();

  if (customers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <div className="text-4xl">💬</div>
        <h3 className="text-lg font-semibold">No hay conversaciones aún</h3>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Las conversaciones de WhatsApp aparecerán aquí cuando los clientes comiencen a interactuar.
          Asegúrate de que el webhook esté configurado correctamente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Mensajes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics[0]?.total_messages || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Últimos 7 días
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mensajes Entrantes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics[0]?.inbound_messages || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              De clientes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mensajes Salientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics[0]?.outbound_messages || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Respuestas del restaurante
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Únicos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics[0]?.unique_customers || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Conversaciones activas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Conversaciones */}
      <Card>
        <CardHeader>
          <CardTitle>Conversaciones Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <div className="space-y-4">
              {customers.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No hay conversaciones registradas
                </div>
              ) : (
                customers.map((customer: any) => (
                  <div
                    key={customer.number}
                    className="p-4 border border-border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => setSelectedConversation(
                      selectedConversation === customer.number ? null : customer.number
                    )}
                  >
                    <div className="flex items-start space-x-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {customer.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium leading-none">
                            {customer.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(customer.lastMessage), 'HH:mm', { locale: es })}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatPhoneNumber(customer.number)}
                        </p>
                        <div className="flex items-center space-x-2 mt-2">
                          <Badge variant="outline">
                            {customer.messages.length} mensajes
                          </Badge>
                          <Badge variant={customer.messages.some((m: WhatsAppConversation) => m.direction === 'inbound') ? 'default' : 'secondary'}>
                            {customer.messages.some((m: WhatsAppConversation) => m.direction === 'inbound') ? 'Cliente activo' : 'Solo respuestas'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {selectedConversation === customer.number && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <div className="space-y-2">
                          {customer.messages.slice(-5).map((message: WhatsAppConversation) => (
                            <div
                              key={message.id}
                              className={`flex ${message.direction === 'inbound' ? 'justify-start' : 'justify-end'}`}
                            >
                              <div
                                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                                  message.direction === 'inbound'
                                    ? 'bg-muted text-muted-foreground'
                                    : 'bg-primary text-primary-foreground'
                                }`}
                              >
                                <p>{message.content}</p>
                                <p className={`text-xs mt-1 ${
                                  message.direction === 'inbound' ? 'text-muted-foreground' : 'text-primary-foreground/70'
                                }`}>
                                  {format(new Date(message.timestamp), 'HH:mm', { locale: es })}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
