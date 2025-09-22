import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Key, Eye, EyeOff } from 'lucide-react'

interface ApiKeyManagerProps {
  onApiKeyChange?: () => void
}

export const ApiKeyManager = ({ onApiKeyChange }: ApiKeyManagerProps) => {
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const savedKey = localStorage.getItem('openai_api_key')
    if (savedKey) {
      setApiKey(savedKey)
    }
  }, [])

  const handleSaveKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('openai_api_key', apiKey.trim())
      onApiKeyChange?.()
      setIsOpen(false)
    }
  }

  const handleRemoveKey = () => {
    localStorage.removeItem('openai_api_key')
    setApiKey('')
    onApiKeyChange?.()
    setIsOpen(false)
  }

  const maskedKey = apiKey ? `${'*'.repeat(Math.max(0, apiKey.length - 8))}${apiKey.slice(-8)}` : ''

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className={`gap-2 ${apiKey ? 'border-green-500 text-green-600' : 'border-orange-500 text-orange-600'}`}
        >
          <Key className="h-4 w-4" />
          {apiKey ? 'API Key Set' : 'Set API Key'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>OpenAI API Key</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Your API key is stored locally in your browser and never sent to our servers.
          </div>
          
          {apiKey ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Current API Key</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Input 
                    value={showKey ? apiKey : maskedKey}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setApiKey('')
                      setShowKey(false)
                    }}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    Update Key
                  </Button>
                  <Button
                    onClick={handleRemoveKey}
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                  >
                    Remove Key
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Enter your OpenAI API Key</label>
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="font-mono"
                />
                <div className="flex justify-between items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowKey(!showKey)}
                    className="text-xs"
                  >
                    {showKey ? 'Hide' : 'Show'} key
                  </Button>
                  <a 
                    href="https://platform.openai.com/api-keys" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    Get API Key →
                  </a>
                </div>
              </div>
              <Button onClick={handleSaveKey} disabled={!apiKey.trim()} className="w-full">
                Save API Key
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export const getStoredApiKey = (): string | null => {
  return localStorage.getItem('openai_api_key')
}