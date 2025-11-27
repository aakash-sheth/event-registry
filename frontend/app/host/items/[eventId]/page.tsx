'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { getErrorMessage, logError, logDebug } from '@/lib/error-handler'

const itemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  image_url: z.union([z.string().url(), z.literal('')]).optional(),
  price_inr: z.number().min(1, 'Price must be greater than 0'),
  qty_total: z.number().min(1, 'Quantity must be at least 1'),
  priority_rank: z.number().default(0),
  status: z.enum(['active', 'hidden']).default('active'),
})

type ItemForm = z.infer<typeof itemSchema>

interface Item {
  id: number
  name: string
  description: string
  image_url: string
  price_inr: number
  qty_total: number
  qty_purchased: number
  priority_rank: number
  status: string
}

export default function ItemsPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string
  const { showToast } = useToast()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState<Item | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ItemForm>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      status: 'active',
      priority_rank: 0,
      qty_total: 1,
    },
  })

  useEffect(() => {
    fetchItems()
  }, [eventId])

  useEffect(() => {
    if (editingItem) {
      reset({
        name: editingItem.name,
        description: editingItem.description,
        image_url: editingItem.image_url || '',
        price_inr: editingItem.price_inr / 100, // Convert paise to rupees
        qty_total: editingItem.qty_total,
        priority_rank: editingItem.priority_rank,
        status: editingItem.status as 'active' | 'hidden',
      })
      setShowForm(true)
    }
  }, [editingItem, reset])

  const fetchItems = async () => {
    try {
      const response = await api.get(`/api/items?event_id=${eventId}`)
      setItems(response.data.results || response.data)
    } catch (error: any) {
      if (error.response?.status === 401) {
        router.push('/host/login')
      } else if (error.response?.status === 403 || error.response?.status === 404) {
        showToast('You do not have access to this event', 'error')
        router.push('/host/dashboard')
      } else {
        showToast('Failed to load items', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (data: ItemForm) => {
    try {
      const payload: any = {
        name: data.name,
        description: data.description || '',
        price_inr: Math.round(data.price_inr * 100), // Convert to paise
        qty_total: data.qty_total,
        priority_rank: data.priority_rank || 0,
        status: data.status || 'active',
        event_id: parseInt(eventId),
      }

      // Only include image_url if it's a valid non-empty URL
      if (data.image_url && data.image_url.trim() !== '') {
        payload.image_url = data.image_url.trim()
      }

      logDebug('Creating/updating item')

      if (editingItem) {
        await api.put(`/api/items/${editingItem.id}/`, payload)
        showToast('Item updated successfully', 'success')
      } else {
        await api.post('/api/items/', payload)
        showToast('Item created successfully', 'success')
      }

      reset()
      setShowForm(false)
      setEditingItem(null)
      fetchItems()
    } catch (error: any) {
      logError('Item creation error:', error)
      showToast(getErrorMessage(error), 'error')
    }
  }

  const handleDelete = async (itemId: number) => {
    if (!confirm('Are you sure you want to delete this item?')) return

    try {
      await api.delete(`/api/items/${itemId}`)
      showToast('Item deleted successfully', 'success')
      fetchItems()
    } catch (error) {
      showToast('Failed to delete item', 'error')
    }
  }

  if (loading) {
    return <div className="container mx-auto p-8">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-eco-beige">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link href={`/host/events/${eventId}`}>
            <Button variant="outline" className="mb-4 border-eco-green text-eco-green hover:bg-eco-green-light">
              ← Back to Event
            </Button>
          </Link>
          <div className="flex justify-between items-center">
            <h1 className="text-4xl font-bold text-eco-green">Manage Items</h1>
            <Button 
              onClick={() => setShowForm(!showForm)}
              className="bg-eco-green hover:bg-green-600 text-white"
            >
              {showForm ? 'Cancel' : '+ Add New Item'}
            </Button>
          </div>
        </div>

        {showForm && (
          <Card className="mb-8 bg-white border-2 border-eco-green-light">
            <CardHeader>
              <CardTitle className="text-eco-green">
                {editingItem ? 'Edit Item' : 'Add New Item'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <Input {...register('name')} />
                  {errors.name && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.name.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Description
                  </label>
                  <textarea
                    {...register('description')}
                    className="flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Image URL
                  </label>
                  <Input {...register('image_url')} type="url" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Price (₹)
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      {...register('price_inr', { valueAsNumber: true })}
                    />
                    {errors.price_inr && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.price_inr.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Quantity
                    </label>
                    <Input
                      type="number"
                      {...register('qty_total', { valueAsNumber: true })}
                    />
                    {errors.qty_total && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.qty_total.message}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Priority Rank (lower = higher priority)
                  </label>
                  <Input
                    type="number"
                    {...register('priority_rank', { valueAsNumber: true })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select
                    {...register('status')}
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowForm(false)
                      setEditingItem(null)
                      reset()
                    }}
                    className="flex-1 border-eco-green text-eco-green hover:bg-eco-green-light"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1 bg-eco-green hover:bg-green-600 text-white">
                    {editingItem ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <Card key={item.id} className="bg-white border-2 border-eco-green-light hover:shadow-lg transition-shadow">
              {item.image_url && (
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="w-full h-48 object-cover rounded-t-lg"
                />
              )}
              <CardHeader>
                <CardTitle className="text-eco-green">{item.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xl font-bold text-eco-green">
                    ₹{(item.price_inr / 100).toLocaleString('en-IN')}
                  </span>
                  <span className="text-sm text-gray-600">
                    {item.qty_purchased}/{item.qty_total} purchased
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setEditingItem(item)}
                    className="flex-1 border-eco-green text-eco-green hover:bg-eco-green-light"
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleDelete(item.id)}
                    className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {items.length === 0 && !showForm && (
          <Card className="bg-white border-2 border-eco-green-light">
            <CardContent className="text-center py-12">
              <div className="text-5xl mb-4">🎁</div>
              <p className="text-gray-600 mb-4 text-lg">No items yet</p>
              <Button 
                onClick={() => setShowForm(true)}
                className="bg-eco-green hover:bg-green-600 text-white"
              >
                Add First Item
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

