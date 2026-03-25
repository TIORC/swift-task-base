import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  mentions: string[];
  created_at: string;
  profile?: { full_name: string | null; avatar_url: string | null } | null;
}

export function useComments(taskId: string | null) {
  return useQuery({
    queryKey: ["comments", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("*")
        .eq("task_id", taskId!)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const userIds = [...new Set(data.map((c) => c.user_id))] as string[];
      let profilesMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", userIds);
        if (profiles) {
          profilesMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
        }
      }

      return data.map((c) => ({
        ...c,
        mentions: (c.mentions as string[]) || [],
        profile: profilesMap[c.user_id] || null,
      })) as Comment[];
    },
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      taskId,
      content,
      mentions,
    }: {
      taskId: string;
      content: string;
      mentions: string[];
    }) => {
      if (!user) throw new Error("Não autenticado");

      const { data, error } = await supabase
        .from("comments")
        .insert({
          task_id: taskId,
          user_id: user.id,
          content,
          mentions,
        })
        .select()
        .single();

      if (error) throw error;

      // Create notifications for mentions
      if (mentions.length > 0) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();

        const senderName = profile?.full_name || user.email || "Alguém";

        const notifications = mentions
          .filter((uid) => uid !== user.id)
          .map((uid) => ({
            user_id: uid,
            type: "mention" as const,
            task_id: taskId,
            message: `${senderName} mencionou você em um comentário`,
            created_by: user.id,
          }));

        if (notifications.length > 0) {
          await supabase.from("notifications").insert(notifications);
        }
      }

      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["comments", vars.taskId] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
