import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Search, UserPlus, Check, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface FUBUser {
  id: number;
  name: string;
  email: string;
  firstName?: string;
  lastName?: string;
  isRegistered: boolean;
  portalRole: string | null;
}

interface FUBResponse {
  configured: boolean;
  users?: FUBUser[];
  error?: string;
}

export function FUBUserSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<FUBUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("agent");
  const { toast } = useToast();

  const { data: fubData, isLoading, error } = useQuery<FUBResponse>({
    queryKey: ["/api/admin/fub/users"],
    enabled: isOpen,
  });

  const inviteMutation = useMutation({
    mutationFn: async (userData: {
      email: string;
      firstName: string;
      lastName: string;
      role: string;
    }) => {
      return apiRequest("POST", "/api/admin/users/invite", userData);
    },
    onSuccess: () => {
      toast({ title: "User invited successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/fub/users"] });
      setSelectedUser(null);
      setIsOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to invite user",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const fubUsers = fubData?.users || [];
  const isConfigured = fubData?.configured ?? true;

  const filteredUsers = fubUsers.filter((user: FUBUser) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.name?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query)
    );
  });

  const handleInvite = () => {
    if (!selectedUser) return;

    const nameParts = selectedUser.name?.split(" ") || [];
    inviteMutation.mutate({
      email: selectedUser.email,
      firstName: selectedUser.firstName || nameParts[0] || "",
      lastName: selectedUser.lastName || nameParts.slice(1).join(" ") || "",
      role: selectedRole,
    });
  };

  const handleOpen = () => {
    setIsOpen(true);
    setSearchQuery("");
    setSelectedUser(null);
    setSelectedRole("agent");
  };

  return (
    <>
      <Button
        onClick={handleOpen}
        variant="outline"
        className="gap-2"
        data-testid="button-import-fub"
      >
        <UserPlus className="w-4 h-4" />
        Import from Follow Up Boss
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Import Users from Follow Up Boss</DialogTitle>
          </DialogHeader>

          {!isConfigured ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Follow Up Boss API is not configured.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Please add the FUB_API_KEY secret to enable this feature.
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="w-12 h-12 text-destructive mb-4" />
              <p className="text-destructive">Failed to fetch users</p>
              <p className="text-sm text-muted-foreground mt-1">
                {(error as Error).message}
              </p>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-fub-search"
                />
              </div>

              <div className="flex-1 overflow-y-auto border rounded-lg min-h-[200px] max-h-[300px]">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchQuery ? "No matching users found" : "No users found in Follow Up Boss"}
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredUsers.map((user: FUBUser) => (
                      <div
                        key={user.id}
                        className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                          selectedUser?.id === user.id
                            ? "bg-muted"
                            : "hover:bg-muted/50"
                        } ${user.isRegistered ? "opacity-60" : ""}`}
                        onClick={() =>
                          !user.isRegistered && setSelectedUser(user)
                        }
                        data-testid={`fub-user-${user.id}`}
                      >
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {user.email}
                          </p>
                        </div>
                        {user.isRegistered ? (
                          <Badge variant="secondary" className="gap-1">
                            <Check className="w-3 h-3" />
                            Registered ({user.portalRole})
                          </Badge>
                        ) : selectedUser?.id === user.id ? (
                          <Badge>Selected</Badge>
                        ) : (
                          <Badge variant="outline">Not Registered</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedUser && (
                <div className="border rounded-lg p-4 bg-muted/30">
                  <p className="text-sm font-medium mb-2">
                    Invite: {selectedUser.name} ({selectedUser.email})
                  </p>
                  <div className="flex items-center gap-4">
                    <label className="text-sm">Assign Role:</label>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger className="w-40" data-testid="select-invite-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="agent">Agent</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={!selectedUser || inviteMutation.isPending || !isConfigured}
              data-testid="button-invite-user"
            >
              {inviteMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Invite User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
